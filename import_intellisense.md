# Import IntelliSense

The Deno VS Code extension supports IntelliSense autocomplete for remote URLs in
import statements.

<!-- TODO(lucacasonato): add gif of the extension in action -->

## FAQ

### How do I enable import IntelliSense?

The Deno VS Code extension can automatically discover domains that are
compatible with import IntelliSense and prompt you to enable it (more about how
this works below). You can manually enable and disable this feature for certain
origins (provided the origin supports it), using the
`deno.import_intellisense_origins` setting. It is supported in workspace and
user settings.

```json
{
  "deno.enable": true,
  "deno.import_intellisense_origins": {
    "https://deno.land": true,
    "https://other.registry": false
  }
}
```

If you want to disable auto-discovery, you can do so by setting the
`import_intellisense_autodiscovery` setting to false. It is supported in
workspace and user settings.

```json
{
  "deno.enable": true,
  "deno.import_intellisense_autodiscovery": false
}
```

### How does it work?

When you want to autocomplete a URL for a supported origin, the extension will
try to fetch a `/.well-known/deno-import-intellisense.json` file from the
origin. This file contains the metadata that the extension needs to know to
complete an IntelliSense request. This manifest describes how a URL for a
registry is structured, and where the registry can fetch the auto-complete
information from.

### Does this work with all URLs on the internet?

No. Deno does not require the use of a certain protocol to fetch imports, and
because of this there is no way to know what files any generic server provides.
Even if this was possible, the autocomplete would not be very good as registry
authors would have no way to customize how their URLs are autocompleted.

Because of these constraints registries that want to support import IntelliSense
must provide information in a structued way that the Deno VS Code extension is
capable of understanding. More information about this can be found in the
[Adding support for a registry](#adding-support-for-a-registry) section.

## Adding support for a registry

> Adding support for a registry requires that you control the domain of the
> registry.

The core of the integration with a registry is a `/.well-known/deno-import-intellisense.json`
that is hosted on your registry's domain (from now on called _wellknown_). It is
requested by the extension if it encounters your domain name. This file contains
the details about how the VS Code extension should query your system about
autocomplete details.

This file is fetched using a `GET` request. It expects a `200 OK` response code,
and the `content-type: application/json` header. It must be UTF8 encoded.

### `wellknown` schema

This file contains two main fields. The `version` field (which has to be `1`)
and an array of registries in the `registries` field. An entry in this registries
array contains two fields: `schema` and `variables`. The schema is a
[`path-to-regexp`](https://github.com/pillarjs/path-to-regexp) formatted string
that describes on which path's on your origin this registry operates. The dynamic
path segments this URL contains are the parts of the URL that a user is able to
autocomplete. The `variables` array is a list of how to autocomplete each dynamic
segment of the URL. Each of these `variable` objects must specify the `key` and
`url` field. The key is the identifier that you used for this field in the
corresponding dynamic path segment of your schema. The URL specifies the URL
that can be used to fetch the list of autocomplete suggestions.

This URL can contain variables that will be replaced with values depending on the
context. These replacement variables should have the format `${module}` (or `${{module}}`
for url encoded). You can use these variables to `https://deno.land/_vsc1/module/${module}`
express a dependency on another variable for the autocompletion. In this example,
you are fetching the `version`s for a specific module. If you were to autocomplete
the versions for the `sqs` module for example, the extension would replace the string
`${module}` with `sqs`, resulting in the URL `https://deno.land/_vsc1/module/sqs`.

The extension does extensive validation of this wellknown file. Additionally to the
type schema described below, there are some rules that the file must adhere to:

- All path segments in the `schema` of a registry must have a corresponding entry
  in the `variables` array for that registry.

- All entries in the `variables` array of a registry, must have a corresponding
  dynamic path segments in the `schema` of that registry.

- The completion URL for a variable must not contain itself as a replacement
  variable.

- The completion URL for a variable must only contain replacement variables whose
  path segments are defined to the left of the path segment for this variable.

The full schema in TypeScript format can be found below:

```ts
interface WellKnown {
  version: 1;
  registries: Array<{
    // The path-to-regexp matcher for this registry URL.
    schema: string;
    // The information about individual dynamic path
    // segments contained in the schema string.
    variables: Array<{
      // The identifier for this variable
      key: string;
      // The URL where completion results can be fetched from.
      url: string;
    }>;
  }>;
}
```

### Fetching data for completion

The URL field for a variable describes what URL should be querried to get
the list of completions for that variable. These URLs will always be querried
with a `GET` request from the extension. The response for this query should be
a `200 OK` with the `content-type: application/json` header and a JSON serialized
string array as body. The response will be cached in accordance with your
cache-control headers. For optimal user experience cache at least 60 seconds.
Example:

```http
GET /_vsc1/modules/sqs HTTP/2
Host: deno.land
user-agent: vscodedeno/1.3.0
accept: application/json

HTTP/2 200
content-type: application/json
content-length: 49
cache-control: max-age=86400

["0.3.3","0.3.2","0.3.1","0.3.0","0.2.0","0.1.0"]
```

If the request is not valid (e.g. module name does not exist) return a `404 Not Found`
error. **Do not return an empty array unless the request was actually valid.**

### Example

Let's illustrate how this works by creating a wellknown file for the `deno.land/x`
registry. It hosts modules on the `https://deno.land` origin, so this file must be
available from `https://deno.land/.well-known/deno-import-intellisense.json`.

Here is the information that is needed to build this _wellknown_ file:

- The `deno.land/x` registry URLs generally look like this:
  `https://deno.land/x/[module name]@[version]/[path]`. The module
  name may only contain the characters `a-z`, `0-9` and `_`.

- A JSON encoded string array of all module names can be found at
  `https://api.deno.land/modules?simple=1`.

- A JSON encoded string array of all versions for a specific module
  can be found at `https://deno.land/_vsc1/modules/[module name]`.
  Example: https://deno.land/_vsc1/modules/sqs

- A JSON encoded string array of all JS/TS files for a given version
  can be found at `https://deno.land/_vsc1/modules/[module name]/v/[version]`.
  Example: https://deno.land/_vsc1/modules/sqs/v/0.3.3

From the registry URL format, we now need to come up with a `path-to-regexp`
schema describing the URL. In this case that would look something like this:
`/x/:module([a-z0-9_]*)@:version/:path*`. We can put this all together now:

```json
{
  "version": 1,
  "registries": [
    {
      "schema": "/x/:module([a-z0-9_]*)@:version?/:path*",
      "variables": [
        {
          "key": "module",
          "url": "https://api.deno.land/modules?simple=1"
        },
        {
          "key": "version",
          "url": "https://deno.land/_vsc1/modules/${module}"
        },
        {
          "key": "path",
          "url": "https://deno.land/_vsc1/modules/${module}/v/${{version}}"
        }
      ]
    }
  ]
}
```

This schema expresses that when a user wants all of the versions for a module,
the extension should query `https://deno.land/_vsc1/modules/${module}`, with
the module name replaced at `${module}`. If the URL trying to be autocompleted
was `https://deno.land/x/sqs@`, the request `https://deno.land/_vsc1/modules/sqs`
would be sent.

As you might know, `deno.land/x` actually has 3 other supported path formats for
modules (`/x/[module name]/[path]`, `/std@[version]/[path]`, and `/std/[path]`).
In the real [`deno.land` well known](https://deno.land/.well-known/deno-import-intellisense.json)
file these are described. For the sake of your time we will not discuss these
further, as they work the same way as the example above.

### Debugging

You're schema might not work on the first attempt. To find out what is not working
correctly open the VS Code `OUTPUT` panel and select `Deno Language Server`. This
is where you can find any schema validation issues your wellknown file might have,
or other errors that happened during completion. If this does not solve your issue,
please reach out on Discord at https://discord.gg/deno.

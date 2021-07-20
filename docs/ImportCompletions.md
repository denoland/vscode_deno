# Import Completions

The extension, via the Deno Language Server, supports completions for remote
URLs in import statements.

## Local import completions

When attempting to import a relative module specifier (one that starts with `./`
or `../`), import completions are provided for directories and files that Deno
thinks it can run (ending with the extensions `.ts`, `.js`, `.tsx`, `.jsx`, or
`.mjs`).

## Workspace import completions

When attempting to import a remote URL that isn't configured as a registry (see
below), the extension will provide remote modules that are already part of the
workspace.

## Module registry completions

Module registries that support it can be configured for auto completion. This
provides a handy way to explore a module registry from the "comfort" of your
IDE.

### Auto-discovery

The Deno language server, by default, will attempt to determine if a server
supports completion suggestions. If the host/origin has not been explicitly
configured, it will check the server, and if it supports completion suggestions
you will be prompted to choose to enable it or not.

You should only enable this for registries you trust, as the remote server could
provide suggestions for modules which are an attempt to get you to run
un-trusted code.

### Configuration

Settings for configuring registries for auto completions:

- `deno.suggest.imports.autoDiscover` - If enabled, when the language server
  discovers a new origin that isn't explicitly configured, it will check to see
  if that origin supports import completions and prompt you to enable it or not.
  This is `true` by default.
- `deno.suggest.imports.hosts` - These are the _origins_ that are configured to
  provide import completions. The target host needs to support Deno import
  completions (detailed below). The value is an object where the key is the host
  and the value is if it is enabled or not. For example:

  ```json
  {
    "deno.suggest.imports.hosts": {
      "https://deno.land": true
    }
  }
  ```

### How does it work?

On startup of the extension and language server, Deno will attempt to fetch
`/.well-known/deno-import-intellisense.json` from any of the hosts that are
configured and enabled. This file provides the data necessary to form auto
completion of module specifiers in a highly configurable way (meaning you aren't
tied into any particular module registry in order to get a rich editor
experience).

As you build or edit your module specifier, Deno will go and fetch additional
parts of the URL from the host based on what is configured in the JSON
configuration file.

When you complete the module specifier, if it isn't already cached locally for
you, Deno will attempt to fetch the completed specifier from the registry.

### Does it work with all remote modules?

No, as the extension and Deno need to understand how to _find_ modules. The
configuration file provides a highly flexible way to allow people to describe
how to build up a URL, including supporting things like semantic versioning if
the module registry supports it.

### The information is out of date.

Currently, the Deno language server uses the same cache logic that is used for
remote modules, and by default, Deno will not invalidate the local cache.
Running the command `Deno: Reload Import Registries Cache` from the command
pallet to clear the cached responses.

## Registry support for import completions

In order to support having a registry be discoverable by the Deno language
server, the registry needs to provide a few things:

- A schema definition file. This file needs to be located at
  `/.well-known/deno-import-intellisense.json`. This file provides the
  configuration needed to allow the Deno language server _query_ the registry
  and construct import specifiers.
- A series of API endpoints that provide the values to be provided to the user
  to complete an import specifier.

### Configuration schema

The JSON response to the schema definition needs to be an object with two
required properties:

- `"version"` - a number, which currently must be equal to `1`.
- `"registries"` - an array of registry objects which define how the module
  specifiers are constructed for this registry.

[There is a JSON Schema document which defines this
schema.](../schemas/deno-import-intellisense.schema.json)

### Registries

In the configuration schema, the `"registries"` property is an array of
registries, which are objects which contain two required properties:

- `"schema"` - a string, which is an Express-like path matching expression,
  which defines how URLs are built on the registry. The syntax is directly based
  on [path-to-regexp](https://github.com/pillarjs/path-to-regexp). For example,
  if the following was the specifier for a URL on the registry:

  ```
  https://example.com/a_package@v1.0.0/mod.ts
  ```

  The schema value might be something like this:

  ```json
  {
    "version": 1,
    "registries": [
      {
        "schema": "/:package([a-z0-9_]*)@:version?/:path*"
      }
    ]
  }
  ```

- `"variables"` - for the keys defined in the schema, a corresponding variable
  needs to be defined, which informs the language server where to fetch
  completions for that part of the module specifier. In the example above, we
  had 3 variables of `package`, `version` and `path`, so we would expect a
  variable definition for each.

### Variables

In the configuration schema, the `"variables"` property is an array of variable
definitions, which are objects with two required properties:

- `"key"` - a string which matches the variable key name specifier in the
  `"schema"` property.
- `"url"` - The fully qualified URL where the language server can fetch the
  completions for the variable. Other variables can be substituted in to build
  the URL. Variables with a single brace format like `${variable}` will be added
  as matched out of the string, and those with double format like
  `${{variable}}` will be percent-encoded as a URI component part. In our
  example above, we had three variables and so our variable definition might
  look like:

  ```json
  {
    "version": 1,
    "registries": [
      {
        "schema": "/:package([a-z0-9_]*)@:version?/:path*",
        "variables": [
          {
            "key": "package",
            "url": "https://api.example.com/packages"
          },
          {
            "key": "version",
            "url": "https://api.example.com/packages/${package}/versions"
          },
          {
            "key": "path",
            "url": "https://api.example.com/packages/${package}/${{version}}/paths"
          }
        ]
      }
    ]
  }
  ```

The response from each URL endpoint needs to be a JSON document that is an
array. Extending our example from above the URL
`https://api.example.com/packages` would be expected to return something like:

```json
[
  "a_package",
  "another_package",
  "my_awesome_package"
]
```

And a query to `https://api.example.com/packages/a_package/versions` would
return something like:

```json
[
  "v1.0.0",
  "v1.0.1",
  "v1.1.0",
  "v2.0.0"
]
```

And a query to
`https://api.example.com/packages/a_package/versions/v1.0.0/paths` would return
something like:

```json
[
  "a.ts",
  "b/c.js",
  "d/e.ts"
]
```

### Schema validation

When the language server is started up (or the configuration for the extension
is changed) the language server will attempt to fetch and validate the schema
configuration for the domain hosts specifier in the configuration.

The validation attempts to make sure that all registries defined are valid, that
the variables contained in those schemas are specified in the variables, and
that there aren't extra variables defined that are not included in the schema.
If the validation fails, the registry won't be enabled and the errors will be
logged to the Deno Language Server output in vscode.

If you are a registry maintainer and need help, advice, or assistance in setting
up your registry for auto-completions, feel free to open up an
[issue](https://github.com/denoland/vscode_deno/issues/new/choose) and we will
try to help.

## Known registries

The following is a list of registries known to us that support the scheme. All
you need to do is add the domain to `deno.suggest.imports.hosts` and set the
value to `true`:

- `https://deno.land/` - both the 3rd party `/x/` registry and the `/std/`
  library registry are available.

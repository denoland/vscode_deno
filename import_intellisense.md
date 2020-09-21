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

<!-- TODO(lucacasonato): how is /.well-known/deno-import-intellisense.json structured -->

<!-- TODO(lucacasonato): what responses must the endpoints return -->

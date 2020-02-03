> Fork from [justjavac/vscode-deno](https://github.com/justjavac/vscode-deno)
>
> Thanks for his contribution

# VS Code Deno extension

[![Version](https://vsmarketplacebadge.apphb.com/version/axetroy.vscode-deno.svg)](https://marketplace.visualstudio.com/items?itemName=axetroy.vscode-deno)
[![Downloads](https://vsmarketplacebadge.apphb.com/downloads/axetroy.vscode-deno.svg)](https://marketplace.visualstudio.com/items?itemName=axetroy.vscode-deno)

Adds Deno support for vs code

![screenshot](screenshot.gif)

## Configuration

- `deno.enabled` - Enable/disable this extension. Default is `false`.

- `deno.dtsFilepaths` - The file paths of the TypeScript declaration file(.d.ts). It can be a relative which path relative to the project directory or an absolute path. Default is `[]`

We recommend that you do not set global configuration. It should be configured in `.vscode/setting.json` in the project directory

```json5
// .vscode/setting.json
{
  "deno.enable": true
}
```

Extensions also provide Deno's formatting tools, setting in `.vscode/setting.json`

```json
{
  "[typescript]": {
    "editor.defaultFormatter": "axetroy.vscode-deno"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "axetroy.vscode-deno"
  },
  "[javascript]": {
    "editor.defaultFormatter": "axetroy.vscode-deno"
  },
  "[javascriptreact]": {
    "editor.defaultFormatter": "axetroy.vscode-deno"
  },
  "[markdown]": {
    "editor.defaultFormatter": "axetroy.vscode-deno"
  },
  "[json]": {
    "editor.defaultFormatter": "axetroy.vscode-deno"
  }
}
```

To configure the format tool, create `.prettierrc.json` in the project directory

```json
{
  "semi": true,
  "singleQuote": false
}
```

If you want to ignore the directory/file. create `.prettieringore` in the project directory

## Commands

This extension contributes the following commands to the Command palette.

- `Enable Deno` - Enable this extension including enable `typescript-deno-plugin`.
- `Disable Deno` - Disable this extension including disable `typescript-deno-plugin`.

## Contribute

Report a bug or a suggestion by posting an issue on the [git repository](https://github.com/axetroy/vscode-deno).

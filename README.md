# VS Code Deno extension

[![Version](https://vsmarketplacebadge.apphb.com/version/axetroy.vscode-deno.svg)](https://marketplace.visualstudio.com/items?itemName=axetroy.vscode-deno)
[![Downloads](https://vsmarketplacebadge.apphb.com/downloads/axetroy.vscode-deno.svg)](https://marketplace.visualstudio.com/items?itemName=axetroy.vscode-deno)

Adds Deno support for vs code

![screenshot](screenshot.gif)

Feature:

- [x] Support Deno declaration file
- [x] Module import intelligent
- [x] Diagnostics
- [x] Deno formatting tool
- [x] C/S model with LSP
- [ ] Support import-map for Deno (TODO)
- [ ] Deno version upgrade detection (TODO)

## Usage

1. Download and enable extension from [vscode market](https://marketplace.visualstudio.com/items?itemName=axetroy.vscode-deno)

2. Enable Deno for your project

create a file `.vscode/setting.json` in your project folder

```json5
// .vscode/setting.json
{
  "deno.enable": true
}
```

3. Enjoy!

## Difference from [justjavac.vscode-deno](https://github.com/justjavac/vscode-deno)

- Almost completely rewritten
- Fix its known issues
- Add some new features
- Integrated [typescript-deno-plugin](typescript-deno-plugin) means easier maintenance

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

1. Fork project

2. Clone into your computer

```bash
$ git clone https://github.com/your_github_name/vscode-deno.git
$ cd vscode-deno
$ yarn # or npm install
```

3. Disable extension in vs code if you have extension before

4. Start debug extension

> Open vs code and find the `Debug` item in the sidebar
>
> And then run `Launch Client` debugger.
>
> Wait for vs code debugger to open a new window

5. Try update code and restart debug

6. Finally, push to your fork and send a PR

## Thanks

This project was originally a fork of [justjavac/vscode-deno](https://github.com/justjavac/vscode-deno)

Thanks for their contributions

## License

The [MIT License](LICENSE)

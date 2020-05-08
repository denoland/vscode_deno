<div align="center">

# Visual Studio Code Deno extension

![GitHub Workflow Status](https://img.shields.io/github/workflow/status/deno/vscode_deno/build)

<!-- [![Coverage Status](https://coveralls.io/repos/github/deno/vscode_deno/badge.svg?branch=refs/heads/master)](https://coveralls.io/github/deno/vscode_deno?branch=refs/heads/master) -->

![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/The-Deno-Authors.vscode-deno)
![Visual Studio Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/The-Deno-Authors.vscode-deno)
![Visual Studio Marketplace Downloads](https://img.shields.io/visual-studio-marketplace/d/The-Deno-Authors.vscode-deno)
![Visual Studio Marketplace Rating](https://img.shields.io/visual-studio-marketplace/r/The-Deno-Authors.vscode-deno)
![Visual Studio Marketplace Rating (Stars)](https://img.shields.io/visual-studio-marketplace/stars/The-Deno-Authors.vscode-deno)

![GitHub code size in bytes](https://img.shields.io/github/languages/code-size/deno/vscode_deno)
![GitHub repo size](https://img.shields.io/github/repo-size/deno/vscode_deno)
![GitHub](https://img.shields.io/github/license/deno/vscode_deno)

Adds Deno support for the Visual Studio Code.

</div>

Features:

- [x] Full intellisense support
- [x] Intelligent module import
- [x] Supports importing ECMAScript modules
- [x] Diagnostics and quick fixes
- [x] Optional use of Deno's built in formatting
- [x] Client/Server model with LSP
- [x] Supports `Import Maps` for Deno
- [x] External type definitions

## Usage

1. Download and enable the extension from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=The-Deno-Authors.vscode-deno)

2. Enable Deno for your project:

   Create a file `.vscode/settings.json` in your project folder:

   ```json5
   // .vscode/settings.json
   {
     "deno.enable": true,
   }
   ```

3. Enjoy!

## Configuration

- `deno.enable` - Enable extension. Default is `false`

- `deno.import_map` - The file paths of Import Map. Default is `null`

- `deno.unstable` - If Deno's unstable mode is enabled. Default is `false`

We recommend that you do not set global configuration. It should be configured in `.vscode/settings.json` in the project directory:

```json5
// .vscode/settings.json
{
  "deno.enable": true,
  "deno.import_map": "./path/to/import_map.json",
  "deno.unstable": false,
}
```

This extension also provides Deno's formatting tools, settings are in `.vscode/settings.json`:

```json5
// .vscode/settings.json
{
  "[typescript]": {
    "editor.defaultFormatter": "The-Deno-Authors.vscode-deno",
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "The-Deno-Authors.vscode-deno",
  },
}
```

## Contribute

Follow these steps to contribute, the community needs your strength.

1. Fork project

2. Clone onto your computer:

   ```bash
   $ git clone https://github.com/your_github_name/vscode_deno.git
   $ cd vscode_deno
   $ yarn # or npm install
   ```

3. Disable extension in Visual Studio Code if you have extension before

4. Start debug extension

   Open Visual Studio Code, find the `Run` item in the sidebar
   and then run `Launch Client` task.

   Wait for Visual Studio Code debugger to open a new window

5. Try updating Visual Studio Code and restart the debugger

6. Finally, push to your fork and send a PR

## License

The [MIT License](LICENSE)

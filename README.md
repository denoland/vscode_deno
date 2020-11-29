# Deno for Visual Studio Code

![GitHub Workflow Status](https://img.shields.io/github/workflow/status/denoland/vscode_deno/ci)
![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/denoland.vscode-deno)
![Visual Studio Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/denoland.vscode-deno)
![Visual Studio Marketplace Downloads](https://img.shields.io/visual-studio-marketplace/d/denoland.vscode-deno)

<img align="right" src=https://raw.githubusercontent.com/denoland/vscode_deno/main/deno.png height="150px">

This extension adds support for using [Deno](https://deno.land) with Visual
Studio Code, powered by `deno lsp`.

> ⚠️ **Important:**
> This branch contains the source code for the upcoming v3 version of the
> extension, powered by `deno lsp`. This version is still in development
> and is currently released on the VS Code marketplace as
> `Deno Language Server - Canary`. The stable release is still v2. You can
> find the source code for this version in the `v2` branch.

## Features

- TypeScript typechecking, quick fixes, hover cards, IntelliSense, and more,
  powered by Deno's built-in TypeScript
- `deno lint` integration, with inline diagnostics <!--, quick fixes, and hover cards for lint rules-->
- `deno fmt` code formatting provider

## Usage

1. Install the Deno and this extension.
2. Open the VS Code command palette with `Ctrl+Shift+P`, and run the `Deno: Init`
   command.

## Configuration

You can control the settings for this extension through your VS Code settings
page. You can open the settings page using the `Ctrl+,` keyboard shortcut. The
extension has the following configuration options:

- `deno.enable`: Controls if the Deno Language Server is enabled. When enabled,
  the extension will disable the built-in VSCode JavaScript and TypeScript
  language services, and will use the Deno Language Server (`deno lsp`) instead.
  _boolean, default `false`_
- `deno.config`: The file path to a `tsconfig.json` file. This is the equivalent
  to using `--config` on the command line. The path can be either be relative to
  the workspace, or an absolute path.
  _string, default `null`, examples: `./tsconfig.json`, `/path/to/tsconfig.json`, `C:\path\to\tsconfig.json`_
- `deno.importMap`: The file path to an import map. This is the equivalent to using
  `--import-map` on the command line. [Import maps](https://github.com/WICG/import-maps#import-maps)
  provide a way to "relocate" modules based on their specifiers. The path can
  either be relative to the workspace, or an absolute path.
  _string, default `null`, examples: `./import-map.json`, `/path/to/import-map.json`, `C:\path\to\import-map.json`_
- `deno.unstable`: Controls if code will be type checked with Deno's unstable APIs.
  This is the equivalent to using `--unstable` on the command line.
  _boolean, default `false`_
- `deno.lint`: Controls if linting information will be provided by the Deno
  Language Server.
  _boolean, default `false`_

## Contribute

We appreciate your help!

To build the extension locally, clone this repository and run the following steps:

1. Open this folder in VS Code.
2. Run `npm i`.
3. Run `npm run compile`.
4. Run the `Launch Client` launch task from the VSCode debug menu.

## Thanks

This project was inspired by [justjavac/vscode-deno](https://github.com/justjavac/vscode-deno) and
[axetroy/vscode-deno](https://github.com/axetroy/vscode-deno). Thanks for their contributions.

## License

The [MIT License](LICENSE)

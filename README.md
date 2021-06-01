# Deno for Visual Studio Code

![GitHub Workflow Status](https://img.shields.io/github/workflow/status/denoland/vscode_deno/ci)

![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/denoland.vscode-deno)
![Visual Studio Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/denoland.vscode-deno)
![Visual Studio Marketplace Downloads](https://img.shields.io/visual-studio-marketplace/d/denoland.vscode-deno)
![Visual Studio Marketplace Rating (Stars)](https://img.shields.io/visual-studio-marketplace/stars/denoland.vscode-deno)

<img align="right" src=https://raw.githubusercontent.com/denoland/vscode_deno/main/deno.png height="150px">

This extension adds support for using [Deno](https://deno.land/) with Visual
Studio Code, powered by the Deno language server.

> ⚠️ **Important:** You need to have a version of Deno CLI installed (v1.7 or
> later). The extension requires the executable and by default will use the
> environment path. You can explicitly set the path to the executable in Visual
> Studio Code Settings for `deno.path`.
> [Check here](https://deno.land/#installation) for instructions on how to
> install the Deno CLI.

![Basic Usage of the Extension](./screenshots/basic_usage.gif)

## Features

- Type checking for JavaScript and TypeScript, including quick fixes, hover
  cards, intellisense, and more.
- Integrates with the version of the Deno CLI you have installed, ensuring there
  is alignment between your editor and the Deno CLI.
- Resolution of modules in line with Deno CLI's module resolution strategy
  allows caching of remote modules in Deno CLI's cache.
- Integration to Deno CLI's linting functionality, including inline diagnostics
  and hover cards.
- Integration to Deno CLI's formatting functionality.
- Allow specifying of import maps and TypeScript configuration files that are
  used with the Deno CLI.
- [Auto completion for imports](./docs/ImportCompletions.md).
- [Workspace folder configuration](./docs/workspaceFolders.md).

## Usage

1. Install the Deno CLI.
2. Install this extension.
3. Ensure `deno` is available in the environment path, or set its path via the
   `deno.path` setting in VSCode.
4. Open the VS Code command palette with `Ctrl+Shift+P`, and run the _Deno:
   Initialize Workspace Configuration_ command.

We recognize that not every TypeScript/JavaScript project that you might work on
in VSCode uses Deno — therefore, by default, this extension will only apply the
Deno language server when the setting `deno.enable` is set to `true`. This can
be done via editing the settings or using the command _Deno: Initialize
Workspace Configuration_.

While you can enable Deno globally, you probably only want to do that if every
JavaScript/TypeScript workspace you work on in VSCode is a Deno based one.

## Commands

The extension provides several commands:

- _Deno: Cache_ - instructs Deno to fetch and cache all the dependencies of the
  current file open in the editor. This is similar to doing `deno cache` on the
  command line. Deno will not automatically fetch and cache remote dependencies.

  > ℹ️ &nbsp; If there are missing dependencies in a module, the extension will
  > provide a quick fix to fetch and cache those dependencies, which invokes
  > this command for you.
- _Deno: Initialize Workspace Configuration_ - will enabled Deno on the current
  workspace and allow you to choose to enable linting and Deno _unstable_ API
  options.
- _Deno: Language Server Status_ - displays a page of information about the
  status of the Deno Language Server. Useful when submitting a bug about the
  extension or the language server. _ _Deno: Reload Import Registries Cache_ -
  reload any cached responses from the configured import registries.
- _Deno: Welcome_ - displays the information document that appears when the
  extension is first installed.

## Formatting

The extension provides formatting capabilities for JavaScript, TypeScript, JSX,
and TSX documents. When choosing to format a document or setting up a default
formatter for these type of files, the extension should be listed as an option.

> ℹ️ &nbsp; It does not currently provide format-on-paste or format-on-type
> capabilities.

## Configuration

You can control the settings for this extension through your VS Code settings
page. You can open the settings page using the `Ctrl+,` keyboard shortcut. The
extension has the following configuration options:

- `deno.enable`: Controls if the Deno Language Server is enabled. When enabled,
  the extension will disable the built-in VSCode JavaScript and TypeScript
  language services, and will use the Deno Language Server (`deno lsp`) instead.
  _boolean, default `false`_
- `deno.path`: A path to the `deno` executable. If unset, the extension will use
  the environment path to resolve the `deno` executable. If set, the extension
  will use the supplied path. The path should include the executable name (e.g.
  `/usr/bin/deno`, `C:\Program Files\deno\deno.exe`).
- `deno.codeLens.implementations`: Enables or disables the display of code lens
  information for implementations for items in the code. _boolean, default
  `false`_
- `deno.codeLens.references`: Enables or disables the display of code lens
  information for references of items in the code. _boolean, default `false`_
- `deno.codeLens.referencesAllFunctions`: Enables or disables the display of
  code lens information for all functions in the code. Requires
  `deno.codeLens.references` to be enabled as well. _boolean, default `false`_
- `deno.config`: The file path to a `tsconfig.json` file. This is the equivalent
  to using `--config` on the command line. The path can be either be relative to
  the workspace, or an absolute path. _string, default `null`, examples:
  `./tsconfig.json`, `/path/to/tsconfig.json`, `C:\path\to\tsconfig.json`_
- `deno.importMap`: The file path to an import map. This is the equivalent to
  using `--import-map` on the command line.
  [Import maps](https://deno.land/manual/linking_to_external_code/import_maps)
  provide a way to "relocate" modules based on their specifiers. The path can
  either be relative to the workspace, or an absolute path. _string, default
  `null`, examples: `./import_map.json`, `/path/to/import_map.json`,
  `C:\path\to\import_map.json`_
- `deno.internalDebug`: If enabled the Deno Language Server will log additional
  internal diagnostic information.
- `deno.lint`: Controls if linting information will be provided by the Deno
  Language Server. _boolean, default `false`_
- `deno.suggest.imports.hosts`: A map of domain hosts (origins) that are used
  for suggesting import auto completions. (See:
  [ImportCompletions](./docs/ImportCompletions.md) for more information.)
- `deno.unstable`: Controls if code will be type checked with Deno's unstable
  APIs. This is the equivalent to using `--unstable` on the command line.
  _boolean, default `false`_

## Contribute

We appreciate your help!

To build the extension locally, clone this repository and run the following
steps:

1. Open this folder in VS Code.
2. Run `npm i`.
3. Run `npm run compile`.
4. Run the `Launch Client` launch task from the VSCode debug menu.

Most changes and feature enhancements do not require changes to the extension
though, as most information comes from the Deno Language Server itself, which is
integrated into the Deno CLI. Please check out the
[contribution guidelines](https://github.com/denoland/deno/tree/master/docs/contributing)
for the Deno CLI.

## Thanks

This project was inspired by
[justjavac/vscode-deno](https://github.com/justjavac/vscode-deno) and
[axetroy/vscode-deno](https://github.com/axetroy/vscode-deno). Thanks for their
contributions.

## License

The [MIT License](LICENSE)

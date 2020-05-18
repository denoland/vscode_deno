# Visual Studio Code Deno extension

Adds Deno support for VS Code using the [TypeScript Deno language service
plugin](https://github.com/justjavac/typescript-deno-plugin).

## Usage

This extension works using VS Code's **built-in version** of TypeScript. You do
not need to configure the plugin in your `tsconfig.json` if you are using VS
Code's version of TypeScript.

If you are using VS Code 1.40 or older and are [using a **workspace version** of
typescript](https://code.visualstudio.com/Docs/languages/typescript#_using-newer-typescript-versions),
you must currently configure the TS Server plugin manually by following [these
instructions](https://github.com/justjavac/typescript-deno-plugin#configuration)

## Preview

### without this plugin

If we write `from "./hello.ts"`, the editor(VS Code) will prompt for a tilde
error. Because the default TypeScript project does not need to write the
extension `.ts`.

> ts(2691): An import path cannot end with a '.ts' extension. Consider importing './hello' instead.

![ts(2691)](https://raw.githubusercontent.com/justjavac/vscode-deno/master/images/ts-error-2691-1.png)

![ts(2691)](https://raw.githubusercontent.com/justjavac/vscode-deno/master/images/ts-error-2691-2.png)

Deno allows imports from URLs, like the browser. But TypeScript can **not** find the module from URLs.

> ts(2307): Cannot find module 'https://deno.land/x/std/log/mod'.

![ts(2307)](https://raw.githubusercontent.com/justjavac/vscode-deno/master/images/ts-error-2307.png)

### after installing this plugin

Deno caches remote imports in a special directory specified by the `$DENO_DIR`
environmental variable. It defaults to the system's cache directory if
`$DENO_DIR` is not specified.

This plugin can resolve remote imports as local path.

![with-plugin](https://raw.githubusercontent.com/justjavac/vscode-deno/master/images/with-plugin.png)

## Configuration

You can configure the Deno extension using a `tsconfig` as described
[here](https://github.com/justjavac/typescript-deno-plugin#configuration), or
configure it with VS Code settings. This requires VS Code 1.40+ and TS 3.8+.
Note the VS Code based configuration overrides the `tsconfig` configuration.

- `deno.enabled` - Enable/disable this extension. Default is `true`.

- `deno.alwaysShowStatus` - Always show the Deno status bar item. Default is `true`.

- `deno.importmap` - The Path of import maps. Default is `null`.

- `deno.autoFmtOnSave` - Turns auto format on save on or off. Default is `false`. (**Not implemented**)

## Commands

This extension contributes the following commands to the Command palette.

- `Enable Deno` - Enable this extension.
- `Disable Deno` - Disable this extension.

## Contribute

Report a bug or a suggestion by posting an issue on the [git
repository](https://github.com/denoland/vscode_deno).

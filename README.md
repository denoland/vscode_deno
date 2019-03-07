# VS Code Deno extension

Adds Deno support for VS Code using the [TypeScript Deno language service plugin](https://github.com/justjavac/typescript-deno-plugin). 

[![](https://vsmarketplacebadge.apphb.com/version/justjavac.vscode-deno.svg)](https://marketplace.visualstudio.com/items?itemName=justjavac.vscode-deno)

## Usage

This extension works using VS Code's **built-in version** of TypeScript. You do not need to configure the plugin in your `tsconfig.json` if you are using VS Code's version of TypeScript.

If you are using VS Code 1.30 or older and are [using a **workspace version** of typescript](https://code.visualstudio.com/Docs/languages/typescript#_using-newer-typescript-versions), you must currently configure the TS Server plugin manually by following [these instructions](https://github.com/justjavac/typescript-deno-plugin#configuration)

## Configuration

You can configure the Deno extension using a `tsconfig` as described [here](https://github.com/justjavac/typescript-deno-plugin#configuration), or configure it with VS Code settings. This requires VS Code 1.30+ and TS 3.2+. Note the VS Code based configuration overrides the `tsconfig` configuration.

 * `deno.enabled` - Enable/disable this extension. Default is `true`.

 * `deno.packageManager` - The package manager you use to install node modules. Default is `npm`. (**Not implemented**)

 * `deno.alwaysShowStatus` - Always show the Deno status bar item. Default is `true`.

 * `deno.autoFmtOnSave` - Turns auto format on save on or off. Default is `false`. (**Not implemented**)

## Commands

This extension contributes the following commands to the Command palette.

- `Enable Deno` - Enable this extension.
- `Disable Deno` - Disable this extension.

## Contribute

Report a bug or a suggestion by posting an issue on the [git repository](https://github.com/justjavac/vscode-deno).

# typescript-deno-plugin

> Deno language service plugin for TypeScript.

[![npm package](https://nodei.co/npm/typescript-deno-plugin.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/typescript-deno-plugin/)

[![Build Status](https://travis-ci.com/justjavac/typescript-deno-plugin.svg?branch=master)](https://travis-ci.com/justjavac/typescript-deno-plugin)
[![NPM version](https://img.shields.io/npm/v/typescript-deno-plugin.svg)](https://www.npmjs.com/package/typescript-deno-plugin)
[![NPM Downloads](https://img.shields.io/npm/dm/typescript-deno-plugin.svg?style=flat)](https://npmcharts.com/compare/typescript-deno-plugin?minimal=true)
[![Install Size](https://packagephobia.now.sh/badge?p=typescript-deno-plugin)](https://packagephobia.now.sh/result?p=typescript-deno-plugin)

## Editor Support

This plugin requires TypeScript 2.3 or later. It can provide intellisense in TypeScript files within any editors that uses TypeScript to power their language features.

### With VS Code

The simplest way to use this plugin is to install the [TypeScript Deno Plugin VS Code extension](https://marketplace.visualstudio.com/items?itemName=justjavac.vscode-deno). This extension enables the plugin when using VS Code's version of TypeScript.

If you are using a workspace version of TypeScript, you must manually install the plugin alongside the version of TypeScript in your workspace.

**use npm**:

```bash
npm install --save-dev typescript-deno-plugin typescript
```

or **use yarn**:

```bash
yarn add -D typescript-deno-plugin typescript
```

### With JetBrains IDEs

Prerequisite: Follow manual installation instructions as described in [VSCode install](#with-vs-code).

1. Open TypScript preferences:

`Preferences | Languages & Frameworks | TypeScript`

2. Change the TypeScript path to the local installed typescript path e.g. `~/myapp/node_modules/typescript`

*Tested with WebStorm. Hypothetically, should run in all JetBrains IDEs.*

### Configuration

After install typescript-deno-plugin, Then you can add a `plugins` section to your [tsconfig.json](http://www.typescriptlang.org/docs/handbook/tsconfig-json.html).

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "typescript-deno-plugin"
      }
    ]
  }
}
```

Finally, run the `Select TypeScript version` command in VS Code to switch to use the workspace version of TypeScript for VS Code's JavaScript and TypeScript language support. You can find more information about managing typescript versions [in the VS Code documentation](https://code.visualstudio.com/Docs/languages/typescript#_using-newer-typescript-versions).

### With Visual Studio

This plugin works Visual Studio 2017 using the TypeScript 2.3+ SDK.

First install the plugin in your project.

**use npm**:

```bash
npm install --save-dev typescript-deno-plugin typescript
```

or **use yarn**:

```bash
yarn add -D typescript-deno-plugin typescript
```

Then add a plugins section to your [tsconfig.json](http://www.typescriptlang.org/docs/handbook/tsconfig-json.html).

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "typescript-deno-plugin"
      }
    ]
  }
}
```

Then reload your project to make sure the plugin has been loaded properly.

### With Atom

This plugin works with the [Atom TypeScript plugin](https://atom.io/packages/atom-typescript).

First install the plugin and a copy of TypeScript in your workspace.

**use npm**:

```bash
npm install --save-dev typescript-deno-plugin typescript
```

or **use yarn**:

```bash
yarn add -D typescript-deno-plugin typescript
```

Then add a plugins section to your [tsconfig.json](http://www.typescriptlang.org/docs/handbook/tsconfig-json.html).

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "typescript-deno-plugin"
      }
    ]
  }
}
```

Then restart Atom.

### Credits

- [justjavac](https://github.com/justjavac)

### License

typescript-deno-plugin is released under the MIT License. See the bundled [LICENSE](./LICENSE) file for details.

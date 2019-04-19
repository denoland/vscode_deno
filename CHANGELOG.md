# Changelog

## 1.2.1 - 2019-04-19

- fix 'can not found module `typescript/lib/tsserverlibrary`' bug

## 1.2.0 - 2019-04-19 [YANKED]

- use deno formater for ci
- add i18n(zh-cn)
- use `configurationSection` instead of literal string [#14](https://github.com/justjavac/vscode-deno/pull/14)
- add badge for travis [#17](https://github.com/justjavac/vscode-deno/pull/17)
- remove unnecessary activationevents [#18](https://github.com/justjavac/vscode-deno/pull/18)
- Generate Deno's .d.ts file [#21](https://github.com/justjavac/vscode-deno/pull/21)
- upgrade `typescript-deno-plugin` from `1.1.0` to [`v1.2.1`](https://github.com/justjavac/typescript-deno-plugin/blob/master/CHANGELOG.md#121---2019-04-19)
  - add headers fallback when module is not found [#3](https://github.com/justjavac/typescript-deno-plugin/pull/3)
  - set default compilation options [#4](https://github.com/justjavac/typescript-deno-plugin/pull/4)
  - add deno declaration files [#5](https://github.com/justjavac/typescript-deno-plugin/pull/5) [#7](https://github.com/justjavac/typescript-deno-plugin/pull/7)

## 1.0.7 - 2019-03-11

- use `execa` instead of `child_process.exec` #6
- refactor: improve performance #7 #9
- add import snippets for deno std #8

## 1.0.4 - 2019-03-07

- Fix warning on found #3

## 1.0.3 - 2019-03-07

- fix bug

## 1.0.2 - 2019-03-07

- add screenshots
- add some ignores

## 1.0.1 - 2019-03-07

- Change `displayName`

## 1.0.0 - 2019-03-07

- Initial release

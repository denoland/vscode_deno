# Changelog

## 1.7.0 - 2020-04-27

- upgrade `deno@0.41.0`, `typescript-deno-plugin@1.5.0`

## 1.5.0 - 2020-04-10

- upgrade `execa@4.0.0`, `typescript@3.8.3`，`typescript-deno-plugin@1.3.0`
- remove some snippets [#72](https://github.com/justjavac/vscode-deno/issues/72)
  - benching
  - colors
  - media_types
  - prettier
  - strings

## 1.4.0 - 2019-12-07

- suport vscode >= 1.14.0
- upgrade `execa@3.4.0`, `which@2.0.2`
- fix deno finder [#58](https://github.com/justjavac/vscode-deno/issues/58)

## 1.3.3 - 2019-08-29

- fix deno version for ci [#52](https://github.com/justjavac/vscode-deno/issues/51)
- upgrade typescript-deno-plugin@1.2.7 [#51](https://github.com/justjavac/vscode-deno/issues/51)
- Bump lodash from 4.17.11 to 4.17.14 [#45](https://github.com/justjavac/vscode-deno/issues/51)

## 1.3.2 - 2019-06-06

- deep merge `compilerOptions` [#34](https://github.com/justjavac/vscode-deno/issues/34)

## 1.3.1 - [YANKED]

## 1.3.0 - 2019-04-28

- Upgrade deno v0.3.9 check [#28](https://github.com/justjavac/vscode-deno/pull/28)

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

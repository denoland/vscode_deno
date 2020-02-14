# [2.0.0](https://github.com/axetroy/vscode-deno/compare/v1.23.0...v2.0.0) (2020-02-14)

### Features

- Deno minimum required v0.33.0 ([014192a](https://github.com/axetroy/vscode-deno/commit/014192a))
- remove `deno.enable` & `deno.disable` command ([#48](https://github.com/axetroy/vscode-deno/issues/48)) ([8ecae2c](https://github.com/axetroy/vscode-deno/commit/8ecae2c))
- rename configuration `deno.dtsFilepaths` to `deno.dts_file` ([#49](https://github.com/axetroy/vscode-deno/issues/49)) ([555a230](https://github.com/axetroy/vscode-deno/commit/555a230))
- upgrade Deno formatter ([#50](https://github.com/axetroy/vscode-deno/issues/50)) ([e872d1c](https://github.com/axetroy/vscode-deno/commit/e872d1c))

# [1.23.0](https://github.com/axetroy/vscode-deno/compare/v1.22.0...v1.23.0) (2020-02-13)

### Features

- add the tips for Deno's minimum version for this extension. ([8b5c54b](https://github.com/axetroy/vscode-deno/commit/8b5c54b))
- Now opening the js file will also launch the extension. the same with tsserver. ([d4a9beb](https://github.com/axetroy/vscode-deno/commit/d4a9beb))
- support external type definitions with `X-TypeScript-Types` headers. close [#35](https://github.com/axetroy/vscode-deno/issues/35) ([98253dd](https://github.com/axetroy/vscode-deno/commit/98253dd))

# [1.22.0](https://github.com/axetroy/vscode-deno/compare/v1.21.0...v1.22.0) (2020-02-11)

### Bug Fixes

- module import intelligent no work correctly when import from 'http/server.ts' ([055d062](https://github.com/axetroy/vscode-deno/commit/055d062))
- Module index is incorrect. close [#47](https://github.com/axetroy/vscode-deno/issues/47) ([d69e90a](https://github.com/axetroy/vscode-deno/commit/d69e90a))

### Features

- Add translations for dutch and german ([#42](https://github.com/axetroy/vscode-deno/issues/42)) ([ed2b7a4](https://github.com/axetroy/vscode-deno/commit/ed2b7a4))
- improve module import intelligent ([faf76c9](https://github.com/axetroy/vscode-deno/commit/faf76c9))

# [1.21.0](https://github.com/axetroy/vscode-deno/compare/v1.20.0...v1.21.0) (2020-02-10)

### Features

- support external type definitions with '/// <reference types=https://raw.githubusercontent.com/date-fns/date-fns/master/typings.d.ts />'. ref: [#35](https://github.com/axetroy/vscode-deno/issues/35) ([f7affb2](https://github.com/axetroy/vscode-deno/commit/f7affb2))

# [1.20.0](https://github.com/axetroy/vscode-deno/compare/v1.19.0...v1.20.0) (2020-02-09)

### Bug Fixes

- update ignore diagnostics code. close [#41](https://github.com/axetroy/vscode-deno/issues/41) ([34e6c10](https://github.com/axetroy/vscode-deno/commit/34e6c10))

### Features

- remove `lock std version` and `prefer HTTPS` diagnostics. close [#33](https://github.com/axetroy/vscode-deno/issues/33) ([2480791](https://github.com/axetroy/vscode-deno/commit/2480791))

# [1.19.0](https://github.com/axetroy/vscode-deno/compare/v1.18.1...v1.19.0) (2020-02-07)

### Bug Fixes

- esm module resolver ([ffe30fb](https://github.com/axetroy/vscode-deno/commit/ffe30fb))

### Features

- remove extension name diagnostic. close [#12](https://github.com/axetroy/vscode-deno/issues/12) ([892bb3f](https://github.com/axetroy/vscode-deno/commit/892bb3f))
- support import ECMA script module. close [#37](https://github.com/axetroy/vscode-deno/issues/37) ([1b68068](https://github.com/axetroy/vscode-deno/commit/1b68068))

## [1.18.1](https://github.com/axetroy/vscode-deno/compare/v1.18.0...v1.18.1) (2020-02-07)

# [1.18.0](https://github.com/axetroy/vscode-deno/compare/v1.17.0...v1.18.0) (2020-02-07)

### Bug Fixes

- create local module no work ([bcceff2](https://github.com/axetroy/vscode-deno/commit/bcceff2))

### Features

- no more use workspace typescript version ([2a6f9da](https://github.com/axetroy/vscode-deno/commit/2a6f9da))
- require min vscode version 1.42.0 ([ab2cc6e](https://github.com/axetroy/vscode-deno/commit/ab2cc6e))
- support top-level await with typescript 3.8 ([cb0e592](https://github.com/axetroy/vscode-deno/commit/cb0e592))

# [1.17.0](https://github.com/axetroy/vscode-deno/compare/v1.16.0...v1.17.0) (2020-02-06)

### Bug Fixes

- create a local module if is not relative or absolute path ([21bacce](https://github.com/axetroy/vscode-deno/commit/21bacce))

### Features

- fully i18n supported. [#31](https://github.com/axetroy/vscode-deno/issues/31) ([04e3938](https://github.com/axetroy/vscode-deno/commit/04e3938))

# [1.16.0](https://github.com/axetroy/vscode-deno/compare/v1.15.0...v1.16.0) (2020-02-05)

### Features

- add default content for creating a file when fix missing local module ([1404f2f](https://github.com/axetroy/vscode-deno/commit/1404f2f))
- add lock deno_std version diagnostic ([8d9097e](https://github.com/axetroy/vscode-deno/commit/8d9097e))
- support Import Maps for Deno. close [#3](https://github.com/axetroy/vscode-deno/issues/3) ([eb187af](https://github.com/axetroy/vscode-deno/commit/eb187af))

# [1.15.0](https://github.com/axetroy/vscode-deno/compare/v1.14.0...v1.15.0) (2020-02-05)

### Bug Fixes

- **deps:** pin dependency execa to 4.0.0 ([#30](https://github.com/axetroy/vscode-deno/issues/30)) ([47ca6e4](https://github.com/axetroy/vscode-deno/commit/47ca6e4))
- `typescript-deno-plugin` may not find modules and cause `typescript` to crash ([8bdc5db](https://github.com/axetroy/vscode-deno/commit/8bdc5db))

### Features

- support quickly fix for diagnostics. close [#29](https://github.com/axetroy/vscode-deno/issues/29) ([da85926](https://github.com/axetroy/vscode-deno/commit/da85926))

# [1.14.0](https://github.com/axetroy/vscode-deno/compare/v1.13.1...v1.14.0) (2020-02-04)

### Bug Fixes

- lock prettier version to make sure formatter work on deno v0.32.0. We will switch to dprint in a future release and only suppport formatting typescript/javascipt code. ([78b3266](https://github.com/axetroy/vscode-deno/commit/78b3266))

### Features

- add `deno.restart_server` command to restart `Deno Language Server`. close [#28](https://github.com/axetroy/vscode-deno/issues/28) ([9a66f86](https://github.com/axetroy/vscode-deno/commit/9a66f86))
- Added i18n support for Chinese Traditional ([ca93cd2](https://github.com/axetroy/vscode-deno/commit/ca93cd2))
- improve status bar. show more information ([6fb83c4](https://github.com/axetroy/vscode-deno/commit/6fb83c4))

## [1.13.1](https://github.com/axetroy/vscode-deno/compare/v1.13.0...v1.13.1) (2020-02-04)

### Bug Fixes

- cannot find module if redirected. close [#27](https://github.com/axetroy/vscode-deno/issues/27) ([6fd7b13](https://github.com/axetroy/vscode-deno/commit/6fd7b13))

# [1.13.0](https://github.com/axetroy/vscode-deno/compare/v1.12.0...v1.13.0) (2020-02-04)

### Bug Fixes

- can not import module which end with `.ts` ([0169107](https://github.com/axetroy/vscode-deno/commit/0169107))
- **deps:** pin dependency vscode-uri to 2.1.1 ([#26](https://github.com/axetroy/vscode-deno/issues/26)) ([5cdf757](https://github.com/axetroy/vscode-deno/commit/5cdf757))
- improve import module position ([8a999c6](https://github.com/axetroy/vscode-deno/commit/8a999c6))

### Features

- improve diagnostics ([a5f029e](https://github.com/axetroy/vscode-deno/commit/a5f029e))

# [1.12.0](https://github.com/axetroy/vscode-deno/compare/v1.11.0...v1.12.0) (2020-02-03)

### Features

- improve folder picker ([71e9658](https://github.com/axetroy/vscode-deno/commit/71e9658))
- remove `deno.enable = true` by default ([532cdf0](https://github.com/axetroy/vscode-deno/commit/532cdf0))
- Warning when import from http ([72d9db3](https://github.com/axetroy/vscode-deno/commit/72d9db3))

# [1.11.0](https://github.com/axetroy/vscode-deno/compare/v1.10.1...v1.11.0) (2020-01-31)

### Bug Fixes

- **deps:** pin dependency typescript to 3.7.5 ([#21](https://github.com/axetroy/vscode-deno/issues/21)) ([3b3049c](https://github.com/axetroy/vscode-deno/commit/3b3049c))
- add missing typescript deps ([751261a](https://github.com/axetroy/vscode-deno/commit/751261a))
- **deps:** pin dependency get-port to 5.1.1 ([#18](https://github.com/axetroy/vscode-deno/issues/18)) ([d3cf219](https://github.com/axetroy/vscode-deno/commit/d3cf219))

### Features

- add diagnostics checking for disable non-extension name module import. close [#12](https://github.com/axetroy/vscode-deno/issues/12) ([8c1c244](https://github.com/axetroy/vscode-deno/commit/8c1c244))

## [1.10.1](https://github.com/axetroy/vscode-deno/compare/v1.10.0...v1.10.1) (2020-01-30)

### Bug Fixes

- formatter not run at workspace folder ([bf6195a](https://github.com/axetroy/vscode-deno/commit/bf6195a))

# [1.10.0](https://github.com/axetroy/vscode-deno/compare/v1.9.2...v1.10.0) (2020-01-30)

### Bug Fixes

- completion show everywhere ([21741a2](https://github.com/axetroy/vscode-deno/commit/21741a2))

## [1.9.2](https://github.com/axetroy/vscode-deno/compare/v1.9.1...v1.9.2) (2020-01-29)

### Bug Fixes

- resolve can not import module not end with .ts when module does not found. close [#5](https://github.com/axetroy/vscode-deno/issues/5) ([1143a97](https://github.com/axetroy/vscode-deno/commit/1143a97))

## [1.9.1](https://github.com/axetroy/vscode-deno/compare/v1.9.0...v1.9.1) (2020-01-29)

### Features

- support top-level await. close [#10](https://github.com/axetroy/vscode-deno/issues/10) ([d1cd97c](https://github.com/axetroy/vscode-deno/commit/d1cd97c))

# [1.9.0](https://github.com/axetroy/vscode-deno/compare/v1.8.0...v1.9.0) (2020-01-26)

### Features

- enable jsx options by default for typescript-deno-plugin ([b9c2fba](https://github.com/axetroy/vscode-deno/commit/b9c2fba))
- support import installed module intelligent. close [#4](https://github.com/axetroy/vscode-deno/issues/4) ([6d9baaa](https://github.com/axetroy/vscode-deno/commit/6d9baaa))

# [1.8.0](https://github.com/axetroy/vscode-deno/compare/v1.7.0...v1.8.0) (2020-01-26)

### Bug Fixes

- only allow .d.ts file for deno.dtsFilepaths ([8916695](https://github.com/axetroy/vscode-deno/commit/8916695))

### Features

- add deno.dtsFilepaths configuration ([458666e](https://github.com/axetroy/vscode-deno/commit/458666e))

# [1.7.0](https://github.com/axetroy/vscode-deno/compare/v1.6.1...v1.7.0) (2020-01-24)

### Features

- enable/disable typescript-deno-plugin in extension scope ([fc2c197](https://github.com/axetroy/vscode-deno/commit/fc2c197))

## [1.6.1](https://github.com/axetroy/vscode-deno/compare/v1.6.0...v1.6.1) (2020-01-24)

### Bug Fixes

- support import.meta.url for Deno ([3a26287](https://github.com/axetroy/vscode-deno/commit/3a26287))

# [1.6.0](https://github.com/axetroy/vscode-deno/compare/v1.5.0...v1.6.0) (2020-01-24)

### Bug Fixes

- try fix ci ([e21e3f9](https://github.com/axetroy/vscode-deno/commit/e21e3f9))
- use yarn package for vsce ([67b2efd](https://github.com/axetroy/vscode-deno/commit/67b2efd))

# [1.5.0](https://github.com/axetroy/vscode-deno/compare/v1.4.1...v1.5.0) (2020-01-23)

## [1.4.1](https://github.com/axetroy/vscode-deno/compare/v1.4.0...v1.4.1) (2020-01-23)

# [1.4.0](https://github.com/axetroy/vscode-deno/compare/v1.3.3...v1.4.0) (2019-12-07)

## [1.3.3](https://github.com/axetroy/vscode-deno/compare/v1.3.2...v1.3.3) (2019-08-29)

## [1.3.2](https://github.com/axetroy/vscode-deno/compare/v1.3.0...v1.3.2) (2019-06-06)

### Features

- add format provider ([#32](https://github.com/axetroy/vscode-deno/issues/32)) ([9636ee2](https://github.com/axetroy/vscode-deno/commit/9636ee2))

# [1.3.0](https://github.com/axetroy/vscode-deno/compare/v1.2.1...v1.3.0) (2019-04-28)

## [1.2.1](https://github.com/axetroy/vscode-deno/compare/v1.2.0...v1.2.1) (2019-04-19)

# [1.2.0](https://github.com/axetroy/vscode-deno/compare/v1.0.7...v1.2.0) (2019-04-19)

## [1.0.7](https://github.com/axetroy/vscode-deno/compare/v1.0.6...v1.0.7) (2019-03-11)

### Features

- add snippets for deno std ([4b5c272](https://github.com/axetroy/vscode-deno/commit/4b5c272))
- use execa instead of child_process.exec for better child process [#5](https://github.com/axetroy/vscode-deno/issues/5) ([06a86f2](https://github.com/axetroy/vscode-deno/commit/06a86f2))

## [1.0.6](https://github.com/axetroy/vscode-deno/compare/v1.0.5...v1.0.6) (2019-03-09)

## [1.0.5](https://github.com/axetroy/vscode-deno/compare/v1.0.4...v1.0.5) (2019-03-08)

## [1.0.4](https://github.com/axetroy/vscode-deno/compare/v1.0.3...v1.0.4) (2019-03-07)

## [1.0.3](https://github.com/axetroy/vscode-deno/compare/v1.0.2...v1.0.3) (2019-03-07)

## [1.0.2](https://github.com/axetroy/vscode-deno/compare/v1.0.1...v1.0.2) (2019-03-07)

## 1.0.1 (2019-03-07)

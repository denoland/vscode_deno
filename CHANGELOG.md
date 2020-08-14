# [4.0.0](https://github.com/axetroy/vscode-deno/compare/v3.7.0...v4.0.0) (2020-05-27)

### Features

- deprecated ([7729788](https://github.com/axetroy/vscode-deno/commit/7729788c37ae23fe206ca218a0bbf8253063077c))

### Reverts

- Revert "deprecated" ([6d13713](https://github.com/axetroy/vscode-deno/commit/6d1371328a843e0c937ea80ae81fb07400a9826a))
- Revert "refactor: remove unused extension" ([25b190b](https://github.com/axetroy/vscode-deno/commit/25b190bf790d930962ab63faa285b0b51cbca9b3))
- Revert "refactor: update" ([479ecd2](https://github.com/axetroy/vscode-deno/commit/479ecd2268b9b3edc087043cca6b4fce954959c0))

# [3.7.0](https://github.com/axetroy/vscode-deno/compare/v3.6.2...v3.7.0) (2020-05-05)

### Features

- added unstable settings option ([#167](https://github.com/axetroy/vscode-deno/issues/167)) ([1a4a230](https://github.com/axetroy/vscode-deno/commit/1a4a230c57a670632c43f947305e7f5fa11d1531))
- remove JSON import statement. Now, you cannot import JSON module. ([23ff6f3](https://github.com/axetroy/vscode-deno/commit/23ff6f3fa6a5388273f2aeaedd8029b5d18b3e7d))

## [3.6.2](https://github.com/axetroy/vscode-deno/compare/v3.6.1...v3.6.2) (2020-04-29)

### Bug Fixes

- file protocol import statement not work. close [#146](https://github.com/axetroy/vscode-deno/issues/146) ([67897bc](https://github.com/axetroy/vscode-deno/commit/67897bc762b1c1b2997b36292ca91eb777a3e9bf))
- not deno project also show deno deps tree view. ([81303df](https://github.com/axetroy/vscode-deno/commit/81303df0e2cc8a942d4a5cd4a7c157b7bebeac5e))

## [3.6.1](https://github.com/axetroy/vscode-deno/compare/v3.6.0...v3.6.1) (2020-04-17)

### Bug Fixes

- In Deno's cache module, `x-typescript-types` and redirects are not parsed correctly. close [#147](https://github.com/axetroy/vscode-deno/issues/147) ([a3a957f](https://github.com/axetroy/vscode-deno/commit/a3a957f617617e19ea69e0941f961b57589574fc))
- **deps:** update dependency semver to v7.3.1 ([#143](https://github.com/axetroy/vscode-deno/issues/143)) ([16a112b](https://github.com/axetroy/vscode-deno/commit/16a112b69318b2ac1fd3cea6de8c4dcd75874e8e))
- **deps:** update dependency semver to v7.3.2 ([#144](https://github.com/axetroy/vscode-deno/issues/144)) ([8496c84](https://github.com/axetroy/vscode-deno/commit/8496c845e17d44e313b9e5139d7e993a865dd956))

# [3.6.0](https://github.com/axetroy/vscode-deno/compare/v3.5.1...v3.6.0) (2020-04-14)

### Bug Fixes

- import map with trailing slash ([#142](https://github.com/axetroy/vscode-deno/issues/142)) ([d5ecc7e](https://github.com/axetroy/vscode-deno/commit/d5ecc7e2ead8df65fcbc30d1e1d08431b91b177e))
- **deps:** update dependency semver to v7.2.2 ([#137](https://github.com/axetroy/vscode-deno/issues/137)) ([d9bd9c8](https://github.com/axetroy/vscode-deno/commit/d9bd9c8df4ffbe0c8446909717a3ce751c43f5eb))
- **deps:** update dependency semver to v7.3.0 ([#140](https://github.com/axetroy/vscode-deno/issues/140)) ([13e3947](https://github.com/axetroy/vscode-deno/commit/13e3947928f1999963c6e2166f5c3e57d61aa67d))

### Features

- ignore typescript compile options which ignore by Deno ([b48fed0](https://github.com/axetroy/vscode-deno/commit/b48fed01dcbd4d5d1bd08e6d060e5217c094b9e6))

## [3.5.1](https://github.com/axetroy/vscode-deno/compare/v3.5.0...v3.5.1) (2020-04-09)

### Bug Fixes

- add more test case for import_map. ref [#132](https://github.com/axetroy/vscode-deno/issues/132) ([e4b1d6a](https://github.com/axetroy/vscode-deno/commit/e4b1d6aee4f55f17f00ef204048e77285f5b5ee3))

# [3.5.0](https://github.com/axetroy/vscode-deno/compare/v3.4.2...v3.5.0) (2020-04-09)

### Bug Fixes

- refresh diagnostic not work ([f8e8e70](https://github.com/axetroy/vscode-deno/commit/f8e8e706f9ef2e45b78aafd5a7b28ddd03c80679))

### Features

- compatible deno cache command since Deno v0.40.0 ([7309b0c](https://github.com/axetroy/vscode-deno/commit/7309b0c3b58bd1a2ed4fc5af65fa0bd3f4626336))
- support deno-types compile hint ([#129](https://github.com/axetroy/vscode-deno/issues/129)) ([9be33a4](https://github.com/axetroy/vscode-deno/commit/9be33a41c8d94c49a1420d124dcdad74b7778ee9))

## [3.4.2](https://github.com/axetroy/vscode-deno/compare/v3.4.1...v3.4.2) (2020-04-08)

### Bug Fixes

- if `x-typescript-types` do not exist. then fallback to origin file ([05496e3](https://github.com/axetroy/vscode-deno/commit/05496e3022e371c5be7e821c9f778c8ed7cfbc77))
- **deps:** update dependency semver to v7.2.1 ([#128](https://github.com/axetroy/vscode-deno/issues/128)) ([90f4ad2](https://github.com/axetroy/vscode-deno/commit/90f4ad2f94db9762f23fdd9b79d73572cf1db5e2))

## [3.4.1](https://github.com/axetroy/vscode-deno/compare/v3.4.0...v3.4.1) (2020-03-31)

### Bug Fixes

- Tsserver crashes in some cases ([11563b4](https://github.com/axetroy/vscode-deno/commit/11563b4df4e84b0c92bc256f2be6bf0dd6fc9954))

# [3.4.0](https://github.com/axetroy/vscode-deno/compare/v3.3.1...v3.4.0) (2020-03-27)

### Bug Fixes

- importmap not work when set to a relative path. close [#103](https://github.com/axetroy/vscode-deno/issues/103) ([0e8398f](https://github.com/axetroy/vscode-deno/commit/0e8398f0892f1a705cff6c4f8721e7b3f71dc948))

### Features

- add diagnostic for checking valid import statement ([b2f070a](https://github.com/axetroy/vscode-deno/commit/b2f070a85058432542fe9721be2d3aa66e6901b3))

## [3.3.1](https://github.com/axetroy/vscode-deno/compare/v3.3.0...v3.3.1) (2020-03-27)

### Bug Fixes

- auto import module not working properly in some edge cases ([71b518b](https://github.com/axetroy/vscode-deno/commit/71b518bf229546c4015763cfea3a30ab7739f7cc))
- output target of compileOption now is esnext ([fcbd234](https://github.com/axetroy/vscode-deno/commit/fcbd234c5a426efac91fc7b4456b1ea63828fc3c))
- Synchronization Deno error code ([4b6efd4](https://github.com/axetroy/vscode-deno/commit/4b6efd41a0d5be3d2b681e0be8e20398a66cae92))
- Triple-Slash Directive does not work. ref [#102](https://github.com/axetroy/vscode-deno/issues/102) ([e381390](https://github.com/axetroy/vscode-deno/commit/e381390ac9461f9bdc7b67a9228e071d64d2ac3b))
- Triple-Slash Directive not resolve module correctly ([175b021](https://github.com/axetroy/vscode-deno/commit/175b02140b0d86872338b35f1070a4739f7bb0d5))
- **deps:** update dependency vscode-languageclient to v6.1.2 ([#99](https://github.com/axetroy/vscode-deno/issues/99)) ([550f0bc](https://github.com/axetroy/vscode-deno/commit/550f0bcf21b9d9a83107c65367a1bd375ccbdb1e))
- **deps:** update dependency vscode-languageclient to v6.1.3 ([#101](https://github.com/axetroy/vscode-deno/issues/101)) ([f5a743c](https://github.com/axetroy/vscode-deno/commit/f5a743c51e789f79540244fc5599291fca9741ab))

# [3.3.0](https://github.com/axetroy/vscode-deno/compare/v3.2.1...v3.3.0) (2020-03-16)

### Bug Fixes

- cannot resolve module if location headers is relative or absolute path. close [#97](https://github.com/axetroy/vscode-deno/issues/97) ([75d6027](https://github.com/axetroy/vscode-deno/commit/75d602755f81a0c22331e08b1c97fdf6782fd9ac))

### Features

- add copy to clipboard message ([4dd4b8d](https://github.com/axetroy/vscode-deno/commit/4dd4b8dc2be31a4d0b628fac638981013284b36a))
- remove `deno.dts_file` configuration ([#94](https://github.com/axetroy/vscode-deno/issues/94)) ([f06e852](https://github.com/axetroy/vscode-deno/commit/f06e852b60883e7499a5c7976d026511bd6dd0ad))

### BREAKING CHANGES

- no more use `deno.dts_file` anymore
  We think this configuration item is redundant

  You can configure external declaration files in `tsconfig.json`

  before:

  ```json5
  //.vscode/settings.json
  {
    "deno.enable": true,
    "deno.dts_file": ["./path/to/demo.d.ts"],
  }
  ```

  after:

  ```json5
  //.vscode/settings.json
  {
    "deno.enable": true,
  }
  ```

## [3.2.1](https://github.com/axetroy/vscode-deno/compare/v3.2.0...v3.2.1) (2020-03-07)

### Bug Fixes

- auto-import not work for some modules. close [#44](https://github.com/axetroy/vscode-deno/issues/44) ([11d38b3](https://github.com/axetroy/vscode-deno/commit/11d38b3f46b8521ec1ea89565f11ec65a9d2cb1d))
- If query exists in url, module will not be parsed correctly ([a8965b5](https://github.com/axetroy/vscode-deno/commit/a8965b5a5742b8ae473d3da85f8fe4829aee82ba))

### Features

- copy url if click code_lens ([e3829d8](https://github.com/axetroy/vscode-deno/commit/e3829d85c355866097f1b24f845e9accc1fd8904))
- make Deno declaration file read-only ([fba8d89](https://github.com/axetroy/vscode-deno/commit/fba8d89f70bbf42f0ea34eff4173ed0de00ef271))

# [3.2.0](https://github.com/axetroy/vscode-deno/compare/v3.1.1...v3.2.0) (2020-03-04)

### Features

- improve fetching module message ([3bb70e2](https://github.com/axetroy/vscode-deno/commit/3bb70e23f51750a3eab053289772f154740c3045))
- support Deno Dependency Viewer. close [#83](https://github.com/axetroy/vscode-deno/issues/83) ([1b327b8](https://github.com/axetroy/vscode-deno/commit/1b327b869cf74d2022dab71451c92ec3c4b5c5ea))

### Performance Improvements

- improve performance for file_walker ([77ce898](https://github.com/axetroy/vscode-deno/commit/77ce898b12c1e9ec9f995c1ae2b14342547f7cbd))

## [3.1.1](https://github.com/axetroy/vscode-deno/compare/v3.1.0...v3.1.1) (2020-03-03)

### Bug Fixes

- auto-import rewrite not work on Windows ([3602979](https://github.com/axetroy/vscode-deno/commit/3602979225fac8a5ffb53e362ab473ea741a3bbf))

# [3.1.0](https://github.com/axetroy/vscode-deno/compare/v3.0.6...v3.1.0) (2020-03-03)

### Bug Fixes

- normalize filepath ([f5ecd71](https://github.com/axetroy/vscode-deno/commit/f5ecd71867f5ed6bf055d7606610c0079dc80065))

### Features

- add CodeLens for deno cached module which will show current URL ([44bc4a1](https://github.com/axetroy/vscode-deno/commit/44bc4a13638822e0ee482a2fba0f23c463e16820))
- improve auto-import completion detail ([78fa0e8](https://github.com/axetroy/vscode-deno/commit/78fa0e86ef017c30349f96794ff3b6eb53cd5879))

## [3.0.6](https://github.com/axetroy/vscode-deno/compare/v3.0.5...v3.0.6) (2020-03-03)

### Bug Fixes

- typescript server crash if create a new untitled typescript TextDocument ref: [#86](https://github.com/axetroy/vscode-deno/issues/86) ([e5643e1](https://github.com/axetroy/vscode-deno/commit/e5643e159042a72ce1871061ff5038be7b6cebb5))

## [3.0.5](https://github.com/axetroy/vscode-deno/compare/v3.0.4...v3.0.5) (2020-03-02)

### Bug Fixes

- extension not work when project has tsconfig.json at root dir ([9ce2874](https://github.com/axetroy/vscode-deno/commit/9ce2874230d4c66ea657f5d2de19c38eb8719df6))

## [3.0.4](https://github.com/axetroy/vscode-deno/compare/v3.0.3...v3.0.4) (2020-03-02)

### Bug Fixes

- 'fetch module' on work correctly for importmap module ([087d834](https://github.com/axetroy/vscode-deno/commit/087d8345ca3a717d55822dce6ab64c6d9385e790))
- invalid http tester regular expression ([3d51ab0](https://github.com/axetroy/vscode-deno/commit/3d51ab04359ad8bd83b5564c144759d08f9d0237))

## [3.0.3](https://github.com/axetroy/vscode-deno/compare/v3.0.2...v3.0.3) (2020-03-02)

### Bug Fixes

- can not set TextDocument's language mode correctly in Windows ([83d6e34](https://github.com/axetroy/vscode-deno/commit/83d6e342d1795c15e1fdba9218bbcddae910e02e))
- Path to module not resolved correctly in Windows ([926896d](https://github.com/axetroy/vscode-deno/commit/926896d33b88971d66f910cf12f881ae5f38405d))
- somethine server does not ready and send notify ([271c9cd](https://github.com/axetroy/vscode-deno/commit/271c9cdda40556f8b8efe8280a7a323074d62544))

### Reverts

- Revert "refactor: typescript-deno-plugin" ([453a9b0](https://github.com/axetroy/vscode-deno/commit/453a9b0240bda3d2521defa5f4dbf74faeeca7a4))

## [3.0.2](https://github.com/axetroy/vscode-deno/compare/v3.0.1...v3.0.2) (2020-03-01)

### Bug Fixes

- parse .vscode/settings.json with json5 ([b3de3d3](https://github.com/axetroy/vscode-deno/commit/b3de3d352784c6dcbcbaf4cfb1aa4550b249b618))

### Reverts

- Revert "docs: add readme for typescript-deno-plugin" ([1be0c24](https://github.com/axetroy/vscode-deno/commit/1be0c24d49d811fb7a5499671d01fe5bcafae6f5))

## [3.0.1](https://github.com/axetroy/vscode-deno/compare/v3.0.0...v3.0.1) (2020-02-29)

### Features

- re-enable typescript-deno-plugin with workspace's typescript version. close [#78](https://github.com/axetroy/vscode-deno/issues/78) ([7a53e70](https://github.com/axetroy/vscode-deno/commit/7a53e7019a9aeba64e0494fe7d9f666540f8a6ce))

# [3.0.0](https://github.com/axetroy/vscode-deno/compare/v2.0.4...v3.0.0) (2020-02-29)

### Bug Fixes

- auto-import in new cache layout ([7726fde](https://github.com/axetroy/vscode-deno/commit/7726fde3ee0e9b1caf7a04bd167fac725600febe))
- fix invalid regexp for Windows ([d37c846](https://github.com/axetroy/vscode-deno/commit/d37c846121d3e3a3decfdcf821205c2f5e40683b))
- fix invalid regexp for Windows ([a96e93a](https://github.com/axetroy/vscode-deno/commit/a96e93abeedc30d018c5c06d60c9e26909fd78f5))
- fix windows url path handle ([b50548e](https://github.com/axetroy/vscode-deno/commit/b50548e4bb87baa62c83fda420d7994ca0e9dba8))
- get file hash without query ([d81850f](https://github.com/axetroy/vscode-deno/commit/d81850fde5197f39bc04adf28de84429b2d0d5a8))
- module not follow redirect ([dc97014](https://github.com/axetroy/vscode-deno/commit/dc97014e31db7bba9859c5d2ba4ef77ddb67c9f3))
- path resolution of Windows ([a9e3336](https://github.com/axetroy/vscode-deno/commit/a9e33363da91ae45f4178db001a9deaedc858429))
- Possible errors caused by optional parameters ([f91085c](https://github.com/axetroy/vscode-deno/commit/f91085ce5b27dde09e22b0e52975f893c111cb6b))
- **deps:** update dependency vscode-languageserver-textdocument to v1.0.1 ([#66](https://github.com/axetroy/vscode-deno/issues/66)) ([c49b0fa](https://github.com/axetroy/vscode-deno/commit/c49b0fac07f1a4d4cdc9a425ef666d9741e22a97))

### Features

- adapt Deno new cache layout ([1cba5df](https://github.com/axetroy/vscode-deno/commit/1cba5df49c10d7d35316949a0e635262d7ee1b30))
- add import map file jso validator ([2ccfa02](https://github.com/axetroy/vscode-deno/commit/2ccfa026f28c2285cd94d8e066a96c37f57eef9a))
- Add memory cache module ([c6cd7e8](https://github.com/axetroy/vscode-deno/commit/c6cd7e8b766398d413c406258d286b7380f5087e))
- add new Deno's cache layout parser and test ([7308978](https://github.com/axetroy/vscode-deno/commit/730897813b2066533c39945bb7eae4af1b261033))
- auto detect ./vscode/settings.json in typescript plugin [#60](https://github.com/axetroy/vscode-deno/issues/60) ([95d73c6](https://github.com/axetroy/vscode-deno/commit/95d73c6b5efa7ba5951cc3c0dd150ce925a429b7))
- make manifest be a iterator. ([8c7b7ce](https://github.com/axetroy/vscode-deno/commit/8c7b7ce81d9eb2110a59b14d7e41d6c08b00c8d3))
- Requires minimum version of Deno 0.35.0 ([35b810c](https://github.com/axetroy/vscode-deno/commit/35b810ca4f5bbb50796d0df4d3efe27908e604a1))
- Resurrected in Deno v0.35.0 🚀 ([3aff7ed](https://github.com/axetroy/vscode-deno/commit/3aff7edf1481a0a234a1b994b9f6cf692e444beb))
- set the language of the document automatically ([8839799](https://github.com/axetroy/vscode-deno/commit/88397994925c42647c77df6e3626922ea3b9d953))
- support [@deno-types](https://github.com/deno-types) hint definition. [#68](https://github.com/axetroy/vscode-deno/issues/68) ([758c5be](https://github.com/axetroy/vscode-deno/commit/758c5be8256efa263a53c8df1bf68ce6beeaed78))
- support format range code ([498d37f](https://github.com/axetroy/vscode-deno/commit/498d37ffa7b4e85efd53c8c34d96b48b313effa1))
- support Import-Maps in new cache layout. ([0c4cccd](https://github.com/axetroy/vscode-deno/commit/0c4cccda2c109963c28064b1f19c58508a16bae9))

## [2.0.4](https://github.com/axetroy/vscode-deno/compare/v2.0.3...v2.0.4) (2020-02-19)

### Bug Fixes

- Try to fix the path processing under windows. ref: [#61](https://github.com/axetroy/vscode-deno/issues/61) ([e3d5bf2](https://github.com/axetroy/vscode-deno/commit/e3d5bf27fc0b678b0928caeb19a3735774179a36))

## [2.0.3](https://github.com/axetroy/vscode-deno/compare/v2.0.2...v2.0.3) (2020-02-19)

### Bug Fixes

- Try to fix the path processing under windows. ref: [#61](https://github.com/axetroy/vscode-deno/issues/61) ([8c02221](https://github.com/axetroy/vscode-deno/commit/8c02221cb2a5abfcafc108ecf2ae88afc3e90f3b))

## [2.0.2](https://github.com/axetroy/vscode-deno/compare/v2.0.1...v2.0.2) (2020-02-19)

### Bug Fixes

- Auto-Import for Deno module incorrectly. now use http protocol modules instead of relative paths. close [#44](https://github.com/axetroy/vscode-deno/issues/44) ([df71fd1](https://github.com/axetroy/vscode-deno/commit/df71fd1d4fa5f47423f1c00b9b181e81f0435dd4))
- typescript-deno-plugin will be disable when open the file out of workspace. ([b0f3aa6](https://github.com/axetroy/vscode-deno/commit/b0f3aa6d6646adf81a9ac091c2d89e82eda35e94))

## [2.0.1](https://github.com/axetroy/vscode-deno/compare/v2.0.0...v2.0.1) (2020-02-18)

### Bug Fixes

- improve typescript-deno-plugin. Make it as unaffected as possible. ([a6ad52f](https://github.com/axetroy/vscode-deno/commit/a6ad52f058860767310c7774ab8bbe34289064c3))
- **deps:** update dependency vscode-languageclient to v6.1.1 ([#58](https://github.com/axetroy/vscode-deno/issues/58)) ([ae547f9](https://github.com/axetroy/vscode-deno/commit/ae547f90153b4519cc3748a79ec5176c16bed46e))
- **deps:** update dependency vscode-languageserver to v6.1.1 ([#57](https://github.com/axetroy/vscode-deno/issues/57)) ([e687f20](https://github.com/axetroy/vscode-deno/commit/e687f207960568e37bc445d63cd133bda413acff))
- import module from 'file:///path/to/module/mod.ts' not work ([962411d](https://github.com/axetroy/vscode-deno/commit/962411de1e6aa15d6a1eb122a6f0b3035017cc03))

### Features

- improve fetch module with progress ([1eaeb41](https://github.com/axetroy/vscode-deno/commit/1eaeb4193299aa77e5a430fb0469c8d020851524))

# [2.0.0](https://github.com/axetroy/vscode-deno/compare/v1.23.0...v2.0.0) (2020-02-14)

### Features

- Deno minimum required v0.33.0 ([014192a](https://github.com/axetroy/vscode-deno/commit/014192a0d1ce80aac3adff5d120fda06c384d03d))
- remove `deno.enable` & `deno.disable` command ([#48](https://github.com/axetroy/vscode-deno/issues/48)) ([8ecae2c](https://github.com/axetroy/vscode-deno/commit/8ecae2c86e28138ac21d12ea29aba34860c3bb95))
- rename configuration `deno.dtsFilepaths` to `deno.dts_file` ([#49](https://github.com/axetroy/vscode-deno/issues/49)) ([555a230](https://github.com/axetroy/vscode-deno/commit/555a230a0476f101a295fd877608f6834d3d6a79))
- upgrade Deno formatter ([#50](https://github.com/axetroy/vscode-deno/issues/50)) ([e872d1c](https://github.com/axetroy/vscode-deno/commit/e872d1cee1af7d9bdf1227165dfecf1c69df8fbe))

# [1.23.0](https://github.com/axetroy/vscode-deno/compare/v1.22.0...v1.23.0) (2020-02-13)

### Features

- add the tips for Deno's minimum version for this extension. ([8b5c54b](https://github.com/axetroy/vscode-deno/commit/8b5c54b8e9fc9f19c47e2b60f36cc140c587f885))
- Now opening the js file will also launch the extension. the same with tsserver. ([d4a9beb](https://github.com/axetroy/vscode-deno/commit/d4a9beb911cec9f02be8ce1faffe5bb4a10ba836))
- support external type definitions with `X-TypeScript-Types` headers. close [#35](https://github.com/axetroy/vscode-deno/issues/35) ([98253dd](https://github.com/axetroy/vscode-deno/commit/98253dd0bda546b6f11beb83926d972540133e33))

# [1.22.0](https://github.com/axetroy/vscode-deno/compare/v1.21.0...v1.22.0) (2020-02-11)

### Bug Fixes

- module import intelligent no work correctly when import from 'http/server.ts' ([055d062](https://github.com/axetroy/vscode-deno/commit/055d062c26aff15c5336c45aa952a1d653ce9cbc))
- Module index is incorrect. close [#47](https://github.com/axetroy/vscode-deno/issues/47) ([d69e90a](https://github.com/axetroy/vscode-deno/commit/d69e90a90df3d7367eb9cb0bd10ec5f3ad21033a))

### Features

- Add translations for dutch and german ([#42](https://github.com/axetroy/vscode-deno/issues/42)) ([ed2b7a4](https://github.com/axetroy/vscode-deno/commit/ed2b7a496d31356331cfb3dda44e06c8020a7476))
- improve module import intelligent ([faf76c9](https://github.com/axetroy/vscode-deno/commit/faf76c9b015778ef7bcf3994a9708c81d8dbacb3))

# [1.21.0](https://github.com/axetroy/vscode-deno/compare/v1.20.0...v1.21.0) (2020-02-10)

### Features

- support external type definitions with '/// <reference types=https://raw.githubusercontent.com/date-fns/date-fns/master/typings.d.ts />'. ref: [#35](https://github.com/axetroy/vscode-deno/issues/35) ([f7affb2](https://github.com/axetroy/vscode-deno/commit/f7affb27fb073f22437db227b2c576e9406d4784))

# [1.20.0](https://github.com/axetroy/vscode-deno/compare/v1.19.0...v1.20.0) (2020-02-09)

### Bug Fixes

- update ignore diagnostics code. close [#41](https://github.com/axetroy/vscode-deno/issues/41) ([34e6c10](https://github.com/axetroy/vscode-deno/commit/34e6c1053c7c4c7928fd3e83a59fdd1e92a11f95))

### Features

- remove `lock std version` and `prefer HTTPS` diagnostics. close [#33](https://github.com/axetroy/vscode-deno/issues/33) ([2480791](https://github.com/axetroy/vscode-deno/commit/2480791f9c002b8d0706f2ffedb5b93ff3c3b407))

# [1.19.0](https://github.com/axetroy/vscode-deno/compare/v1.18.1...v1.19.0) (2020-02-07)

### Bug Fixes

- esm module resolver ([ffe30fb](https://github.com/axetroy/vscode-deno/commit/ffe30fbbde5e65b9d0741020b820d5b323db5cd1))

### Features

- remove extension name diagnostic. close [#12](https://github.com/axetroy/vscode-deno/issues/12) ([892bb3f](https://github.com/axetroy/vscode-deno/commit/892bb3fe8822500b48d9b1bfacffaa1d4a7c17ba))
- support import ECMA script module. close [#37](https://github.com/axetroy/vscode-deno/issues/37) ([1b68068](https://github.com/axetroy/vscode-deno/commit/1b6806854581b9f0b9460526c730eb19dcc511d4))

## [1.18.1](https://github.com/axetroy/vscode-deno/compare/v1.18.0...v1.18.1) (2020-02-07)

### Reverts

- Revert "feat: support top-level await with typescript 3.8" ([341165e](https://github.com/axetroy/vscode-deno/commit/341165e7d1c25e1a4f2d7aab8866f54fb9b8f110))

# [1.18.0](https://github.com/axetroy/vscode-deno/compare/v1.17.0...v1.18.0) (2020-02-07)

### Bug Fixes

- create local module no work ([bcceff2](https://github.com/axetroy/vscode-deno/commit/bcceff232ded01eb28575db7151b4116968945c1))

### Features

- no more use workspace typescript version ([2a6f9da](https://github.com/axetroy/vscode-deno/commit/2a6f9da82aac305431dccc6539b66eb66866155e))
- require min vscode version 1.42.0 ([ab2cc6e](https://github.com/axetroy/vscode-deno/commit/ab2cc6e677f08e0392fc8b551fbae9e8e303bcee))
- support top-level await with typescript 3.8 ([cb0e592](https://github.com/axetroy/vscode-deno/commit/cb0e592136f569e58daee56a7d2f46759b7ca946))

# [1.17.0](https://github.com/axetroy/vscode-deno/compare/v1.16.0...v1.17.0) (2020-02-06)

### Bug Fixes

- create a local module if is not relative or absolute path ([21bacce](https://github.com/axetroy/vscode-deno/commit/21bacce8dbba3837a363aeb47ba8aefd262295a4))

### Features

- fully i18n supported. [#31](https://github.com/axetroy/vscode-deno/issues/31) ([04e3938](https://github.com/axetroy/vscode-deno/commit/04e3938197c6de200f79b6115c8ab3b9cff3651e))

# [1.16.0](https://github.com/axetroy/vscode-deno/compare/v1.15.0...v1.16.0) (2020-02-05)

### Features

- add default content for creating a file when fix missing local module ([1404f2f](https://github.com/axetroy/vscode-deno/commit/1404f2f712867116801cd09a0f1122298218fd42))
- add lock deno_std version diagnostic ([8d9097e](https://github.com/axetroy/vscode-deno/commit/8d9097e3cb23925966e7339b344fa99cd6d6d491))
- support Import Maps for Deno. close [#3](https://github.com/axetroy/vscode-deno/issues/3) ([eb187af](https://github.com/axetroy/vscode-deno/commit/eb187afd06685c9462fcdace820f29754385f860))

# [1.15.0](https://github.com/axetroy/vscode-deno/compare/v1.14.0...v1.15.0) (2020-02-05)

### Bug Fixes

- **deps:** pin dependency execa to 4.0.0 ([#30](https://github.com/axetroy/vscode-deno/issues/30)) ([47ca6e4](https://github.com/axetroy/vscode-deno/commit/47ca6e47d3dc0e8dbb350225d269ccae7daca278))
- `typescript-deno-plugin` may not find modules and cause `typescript` to crash ([8bdc5db](https://github.com/axetroy/vscode-deno/commit/8bdc5db5863212efee62e51b9965c811c1cdeb34))

### Features

- support quickly fix for diagnostics. close [#29](https://github.com/axetroy/vscode-deno/issues/29) ([da85926](https://github.com/axetroy/vscode-deno/commit/da859261e33d86b22e01560557f71f4d76b087c2))

# [1.14.0](https://github.com/axetroy/vscode-deno/compare/v1.13.1...v1.14.0) (2020-02-04)

### Bug Fixes

- lock prettier version to make sure formatter work on deno v0.32.0. We will switch to dprint in a future release and only suppport formatting typescript/javascipt code. ([78b3266](https://github.com/axetroy/vscode-deno/commit/78b3266ab426b28e288ff02c677f44593647e2b9))

### Features

- add `deno.restart_server` command to restart `Deno Language Server`. close [#28](https://github.com/axetroy/vscode-deno/issues/28) ([9a66f86](https://github.com/axetroy/vscode-deno/commit/9a66f867f93729b4b753abc4117fb65f3cba72a3))
- Added i18n support for Chinese Traditional ([ca93cd2](https://github.com/axetroy/vscode-deno/commit/ca93cd24b28924fd065554f748eb653d23b3a449))
- improve status bar. show more information ([6fb83c4](https://github.com/axetroy/vscode-deno/commit/6fb83c4a496a2c031247d4675c2838b073318911))

## [1.13.1](https://github.com/axetroy/vscode-deno/compare/v1.13.0...v1.13.1) (2020-02-04)

### Bug Fixes

- cannot find module if redirected. close [#27](https://github.com/axetroy/vscode-deno/issues/27) ([6fd7b13](https://github.com/axetroy/vscode-deno/commit/6fd7b13dc1394687dbae6a6a6e5f60d01f72cd64))

# [1.13.0](https://github.com/axetroy/vscode-deno/compare/v1.12.0...v1.13.0) (2020-02-04)

### Bug Fixes

- can not import module which end with `.ts` ([0169107](https://github.com/axetroy/vscode-deno/commit/01691075d9d236b6a0780f960f871206788fea44))
- **deps:** pin dependency vscode-uri to 2.1.1 ([#26](https://github.com/axetroy/vscode-deno/issues/26)) ([5cdf757](https://github.com/axetroy/vscode-deno/commit/5cdf7571673a9c5fbfbfe8858488fbb7525e1027))
- improve import module position ([8a999c6](https://github.com/axetroy/vscode-deno/commit/8a999c667ea474ee769dbf72972a08f9d8f71465))

### Features

- improve diagnostics ([a5f029e](https://github.com/axetroy/vscode-deno/commit/a5f029e35f9af3692d8f7192fecd648237d00c1c))

# [1.12.0](https://github.com/axetroy/vscode-deno/compare/v1.11.0...v1.12.0) (2020-02-03)

### Features

- improve folder picker ([71e9658](https://github.com/axetroy/vscode-deno/commit/71e9658fb4aea962941a0d4b7f03a6cbc80d50e1))
- remove `deno.enable = true` by default ([532cdf0](https://github.com/axetroy/vscode-deno/commit/532cdf0af76ac436243b20c885c406386a20f202))
- Warning when import from http ([72d9db3](https://github.com/axetroy/vscode-deno/commit/72d9db3c7ce5b483ef0fb7d3e6310b7adf5974c2))

# [1.11.0](https://github.com/axetroy/vscode-deno/compare/v1.10.1...v1.11.0) (2020-01-31)

### Bug Fixes

- **deps:** pin dependency typescript to 3.7.5 ([#21](https://github.com/axetroy/vscode-deno/issues/21)) ([3b3049c](https://github.com/axetroy/vscode-deno/commit/3b3049c19d1438b3357eef77f4b6241b535db3d2))
- add missing typescript deps ([751261a](https://github.com/axetroy/vscode-deno/commit/751261aaeb8a6a2931687a8082b5bbce591d7ba2))
- **deps:** pin dependency get-port to 5.1.1 ([#18](https://github.com/axetroy/vscode-deno/issues/18)) ([d3cf219](https://github.com/axetroy/vscode-deno/commit/d3cf21902f0b6930640cd7b1f603649746833ac5))

### Features

- add diagnostics checking for disable non-extension name module import. close [#12](https://github.com/axetroy/vscode-deno/issues/12) ([8c1c244](https://github.com/axetroy/vscode-deno/commit/8c1c24419fe07bd7f511605ce0b062b0ae16199a))

## [1.10.1](https://github.com/axetroy/vscode-deno/compare/v1.10.0...v1.10.1) (2020-01-30)

### Bug Fixes

- formatter not run at workspace folder ([bf6195a](https://github.com/axetroy/vscode-deno/commit/bf6195a1978787c53b5135a43245ee6295ca945f))

# [1.10.0](https://github.com/axetroy/vscode-deno/compare/v1.9.2...v1.10.0) (2020-01-30)

### Bug Fixes

- completion show everywhere ([21741a2](https://github.com/axetroy/vscode-deno/commit/21741a265e38c1187c9e8a8cc71465489a250db1))

## [1.9.2](https://github.com/axetroy/vscode-deno/compare/v1.9.1...v1.9.2) (2020-01-29)

### Bug Fixes

- resolve can not import module not end with .ts when module does not found. close [#5](https://github.com/axetroy/vscode-deno/issues/5) ([1143a97](https://github.com/axetroy/vscode-deno/commit/1143a97d59672439bb5bf1e9b0fd5279df78d4eb))

## [1.9.1](https://github.com/axetroy/vscode-deno/compare/v1.9.0...v1.9.1) (2020-01-29)

### Features

- support top-level await. close [#10](https://github.com/axetroy/vscode-deno/issues/10) ([d1cd97c](https://github.com/axetroy/vscode-deno/commit/d1cd97ce0748ff1b4df96726efb6cda308197dd8))

# [1.9.0](https://github.com/axetroy/vscode-deno/compare/v1.8.0...v1.9.0) (2020-01-26)

### Features

- enable jsx options by default for typescript-deno-plugin ([b9c2fba](https://github.com/axetroy/vscode-deno/commit/b9c2fbaefe733288ec62e46e8798d6b634f7eea9))
- support import installed module intelligent. close [#4](https://github.com/axetroy/vscode-deno/issues/4) ([6d9baaa](https://github.com/axetroy/vscode-deno/commit/6d9baaadf3ae1eeb75e9fd46e1e567c9c8c66086))

# [1.8.0](https://github.com/axetroy/vscode-deno/compare/v1.7.0...v1.8.0) (2020-01-26)

### Bug Fixes

- only allow .d.ts file for deno.dtsFilepaths ([8916695](https://github.com/axetroy/vscode-deno/commit/8916695fe86b2281c66f2ca75642b6511e6a744c))

### Features

- add deno.dtsFilepaths configuration ([458666e](https://github.com/axetroy/vscode-deno/commit/458666eba1c649a673c56e8d28179e4cd9860d6a))

# [1.7.0](https://github.com/axetroy/vscode-deno/compare/v1.6.1...v1.7.0) (2020-01-24)

### Features

- enable/disable typescript-deno-plugin in extension scope ([fc2c197](https://github.com/axetroy/vscode-deno/commit/fc2c1977fc320b0b4609ca50bb02466fdbc7cc23))

## [1.6.1](https://github.com/axetroy/vscode-deno/compare/v1.6.0...v1.6.1) (2020-01-24)

### Bug Fixes

- support import.meta.url for Deno ([3a26287](https://github.com/axetroy/vscode-deno/commit/3a26287d3d38a6aa9a55d87c2652c3839e91793c))

# [1.6.0](https://github.com/axetroy/vscode-deno/compare/v1.5.0...v1.6.0) (2020-01-24)

### Bug Fixes

- try fix ci ([e21e3f9](https://github.com/axetroy/vscode-deno/commit/e21e3f9a89bd3be7706a323af0e4e6b21450c77e))
- use yarn package for vsce ([67b2efd](https://github.com/axetroy/vscode-deno/commit/67b2efdc7363206efda14dd7c40c57db6b4162a2))

# [1.5.0](https://github.com/axetroy/vscode-deno/compare/v1.4.1...v1.5.0) (2020-01-23)

## [1.4.1](https://github.com/axetroy/vscode-deno/compare/v1.4.0...v1.4.1) (2020-01-23)

# [1.4.0](https://github.com/axetroy/vscode-deno/compare/v1.3.3...v1.4.0) (2019-12-07)

## [1.3.3](https://github.com/axetroy/vscode-deno/compare/v1.3.2...v1.3.3) (2019-08-29)

## [1.3.2](https://github.com/axetroy/vscode-deno/compare/v1.3.0...v1.3.2) (2019-06-06)

### Features

- add format provider ([#32](https://github.com/axetroy/vscode-deno/issues/32)) ([9636ee2](https://github.com/axetroy/vscode-deno/commit/9636ee26359339ffd2149557af2e76a8f29b6e29))

# [1.3.0](https://github.com/axetroy/vscode-deno/compare/v1.2.1...v1.3.0) (2019-04-28)

## [1.2.1](https://github.com/axetroy/vscode-deno/compare/v1.2.0...v1.2.1) (2019-04-19)

# [1.2.0](https://github.com/axetroy/vscode-deno/compare/v1.0.7...v1.2.0) (2019-04-19)

### Reverts

- Revert "implement auto format on save (#13)" (#19) ([8d29205](https://github.com/axetroy/vscode-deno/commit/8d29205104fc6ca7e35de01a24ceb240f2ae7d77)), closes [#13](https://github.com/axetroy/vscode-deno/issues/13) [#19](https://github.com/axetroy/vscode-deno/issues/19)

## [1.0.7](https://github.com/axetroy/vscode-deno/compare/v1.0.6...v1.0.7) (2019-03-11)

### Features

- add snippets for deno std ([4b5c272](https://github.com/axetroy/vscode-deno/commit/4b5c2727b65dea5ae966e6fa686bc3f5d2d965de))
- use execa instead of child_process.exec for better child process [#5](https://github.com/axetroy/vscode-deno/issues/5) ([06a86f2](https://github.com/axetroy/vscode-deno/commit/06a86f23ea1b4a0d501ab676abe2a890fa9f6354))

## [1.0.6](https://github.com/axetroy/vscode-deno/compare/v1.0.5...v1.0.6) (2019-03-09)

### Reverts

- Revert "bundling extension using webpack" ([2b451ff](https://github.com/axetroy/vscode-deno/commit/2b451ff9b6f50ccc7edab19d28f376f5ee19923d))

## [1.0.5](https://github.com/axetroy/vscode-deno/compare/v1.0.4...v1.0.5) (2019-03-08)

## [1.0.4](https://github.com/axetroy/vscode-deno/compare/v1.0.3...v1.0.4) (2019-03-07)

## [1.0.3](https://github.com/axetroy/vscode-deno/compare/v1.0.2...v1.0.3) (2019-03-07)

## [1.0.2](https://github.com/axetroy/vscode-deno/compare/v1.0.1...v1.0.2) (2019-03-07)

## 1.0.1 (2019-03-07)

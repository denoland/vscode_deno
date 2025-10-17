# Change Log

Releases of the extension can be downloaded from
[Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=denoland.vscode-deno).

### [3.46.0](https://github.com/denoland/vscode_deno/compare/3.45.2...3.46.0) / 2025.10.17

- feat: "DENO_DISABLE_WELCOME_PAGE" env var (#1339)

### [3.45.2](https://github.com/denoland/vscode_deno/compare/3.45.1...3.45.2) / 2025.08.06

- chore: update vscode-languageclient to 10.0.0-next.13 (#1324)
- docs: update description of 'deno.unstable' (#1326)

### [3.45.1](https://github.com/denoland/vscode_deno/compare/3.45.0...3.45.1) / 2025.08.04

- chore: update vscode-languageclient (#1322)

### [3.45.0](https://github.com/denoland/vscode_deno/compare/3.44.2...3.45.0) / 2025.07.16

- feat: show task description from deno.json in tasks view and command palette (#1304)
- fix: enable colored output in tests (#1298)
- chore: remove tsconfig helper prompt (#1315)

### [3.44.2](https://github.com/denoland/vscode_deno/compare/3.44.1...3.44.2) / 2025.05.13

- fix: empty tasks pane on win machines (#1296)

### [3.44.1](https://github.com/denoland/vscode_deno/compare/3.44.0...3.44.1) / 2025.05.04

- fix: handle different drive letters in pathStartsWith() (#1291)

### [3.44.0](https://github.com/denoland/vscode_deno/compare/3.43.6...3.44.0) / 2025.04.29

- feat: lockfile v5 schema (#1286)
- feat: sync vscode-userdata schemed documents with the lsp (#1278)
- fix: enable paths in the global npm cache (#1277)

### [3.43.6](https://github.com/denoland/vscode_deno/compare/3.43.5...3.43.6) / 2025.03.12

- fix(client): set `{ shell: true }` in server options for "deno.{bat,cmd}" (#1273)
- docs: `deno.codeLens.test` is not deprecated (#1268)

### [3.43.5](https://github.com/denoland/vscode_deno/compare/3.43.4...3.43.5) / 2025.02.26

- Revert "fix: move extended language formatting to client" (#1261)

### [3.43.4](https://github.com/denoland/vscode_deno/compare/3.43.3...3.43.4) / 2025.02.25

- fix: move extended language formatting to client (#1258)

### [3.43.3](https://github.com/denoland/vscode_deno/compare/3.43.2...3.43.3) / 2025.01.30

- chore: include "rootDirs" when transferring compiler options (#1248)

### [3.43.2](https://github.com/denoland/vscode_deno/compare/3.43.1...3.43.2) / 2025.01.02

- chore: sync css preprocessor documents with the lsp (#1233)
- fix: add svelte as a recognised file for deno extension (#1227)
- fix: lockfile schema - remote is not required (#1225)

### [3.43.1](https://github.com/denoland/vscode_deno/compare/3.43.0...3.43.1) / 2024.12.13

- chore: sync sql and component documents with the lsp (#1223)

### [3.43.0](https://github.com/denoland/vscode_deno/compare/3.42.0...3.43.0) / 2024.11.26

- feat: "deno.trace.server" setting (#1189)
- feat: enable "sloppy-imports" by tsconfig prompt (#1208)
- feat: disable "enableProjectDiagnostics" on enable (#1191)
- fix: support task object notation in sidebar (#1214)

### [3.42.0](https://github.com/denoland/vscode_deno/compare/3.41.1...3.42.0) / 2024.10.13

- feat: lockfile v4 schema (#1182)
- feat: update icon for Deno 2 (#1175)
- chore: update links (#1174)

### [3.41.1](https://github.com/denoland/vscode_deno/compare/3.41.0...3.41.1) / 2024.10.07

- chore: log to the output window if disabled completely (#1172)

### [3.41.0](https://github.com/denoland/vscode_deno/compare/3.40.0...3.41.0) / 2024.09.23

- feat: helper prompts for tsconfig.json compiler options (#1166)
- feat: use --inspect-wait for prerelease deno (#1150)

### [3.40.0](https://github.com/denoland/vscode_deno/compare/3.39.0...3.40.0) / 2024.09.10

- feat: unstable setting as list (#1159)

### [3.39.0](https://github.com/denoland/vscode_deno/compare/3.38.2...3.39.0) / 2024.09.02

- chore: sync html/css/yaml documents with the lsp (#1154)

### [3.38.2](https://github.com/denoland/vscode_deno/compare/3.38.1...3.38.2) / 2024.08.13

- fix: downgrade vsce to 2.31.0 to fix broken imports (#1147)

### [3.38.1](https://github.com/denoland/vscode_deno/compare/3.38.0...3.38.1) / 2024.08.13

- fix: use includePrerelease when checking minimum server version (#1142)

### [3.38.0](https://github.com/denoland/vscode_deno/compare/3.37.1...3.38.0) / 2024.07.03

- feat: "deno.env" and "deno.envFile" settings (#1128)

### [3.37.1](https://github.com/denoland/vscode_deno/compare/3.37.0...3.37.1) / 2024.05.09

- fix: handle nested config files in tasks sidebar (#1111)
- fix: don't spawn the language server if explicitly disabled settings (#1109)

### [3.37.0](https://github.com/denoland/vscode_deno/compare/3.36.0...3.37.0) / 2024.04.12

- fix: normalize notebook cell filename in plugin (#1103)
- feat: add "deno.future" setting (#1101)

### [3.36.0](https://github.com/denoland/vscode_deno/compare/3.35.1...3.36.0) / 2024.03.27

- chore: enable "deno.cacheOnSave" by default (#1092)

### [3.35.1](https://github.com/denoland/vscode_deno/compare/3.35.0...3.35.1) / 2024.03.10

- ci: add write permission (#1090)

### [3.35.0](https://github.com/denoland/vscode_deno/compare/3.34.0...3.35.0) / 2024.03.09

- fix: explicitly allow null in deno.enable (#1083)
- fix: sort enable settings by folder (#1086)
- feat: run task via context menu (#1087)

### [3.34.0](https://github.com/denoland/vscode_deno/compare/3.33.3...3.34.0) / 2024.02.25

- chore: rename "deno/task" request to "deno.taskDefinitions" (#1057)
- fix: register commands before starting language server (#1056)
- feat: restore init workspace command as alias (#1059)
- feat: show a modal dialog after workspace init (#1060)

### [3.33.3](https://github.com/denoland/vscode_deno/compare/3.33.2...3.33.3) / 2024.01.26

- fix: check configuration type for deno.json detection (#1053)
- fix: remove undefined ref in lockfile schema (#1052)

### [3.33.2](https://github.com/denoland/vscode_deno/compare/3.33.1...3.33.2) / 2024.01.25

- fix: treat enable settings as optional in plugin (#1046)

### [3.33.1](https://github.com/denoland/vscode_deno/compare/3.33.0...3.33.1) / 2024.01.25

- fix: refresh enable settings before initializing plugin (#1044)

### [3.33.0](https://github.com/denoland/vscode_deno/compare/3.32.0...3.33.0) / 2024.01.24

- feat: add workspace and jsr fields to lockfile schema (#1038)

### [3.32.0](https://github.com/denoland/vscode_deno/compare/3.31.0...3.32.0) / 2024.01.24

- chore: default "deno.enablePaths" to null (#1028)
- feat: remove init workspace command (#1027)
- feat: accept notifications for subdirectory deno.json files (#1034)

### [3.31.0](https://github.com/denoland/vscode_deno/compare/3.30.0...3.31.0) / 2023.12.28

- chore: upgrade typescript to 5.0.2 (#1020)
- chore: only construct log string when logging enabled (#1019)
- feat: "deno.internalInspect" setting (#1007)

### [3.30.0](https://github.com/denoland/vscode_deno/compare/3.29.0...3.30.0) / 2023.12.18

- feat: version info command (#1008)
- feat: "deno.client.enable" and "deno.client.disable" commands (#1010)
- fix: use "denoTasks" type for task-sidebar commands (#1013)

### [3.29.0](https://github.com/denoland/vscode_deno/compare/3.28.0...3.29.0) / 2023.12.8

- feat: "deno.logFile" setting (#1003)
- fix: tasks panel empty on win machines (#996)

### [3.28.0](https://github.com/denoland/vscode_deno/compare/3.27.0...3.28.0) / 2023.11.16

- feat: deno upgrade prompt (#988)
- chore: remove compat paths for lsp < 1.37.0 (#992)

### [3.27.0](https://github.com/denoland/vscode_deno/compare/3.26.0...3.27.0) / 2023.11.01

- fix: update tasks sidebar on config change notification (#964)
- fix: don't error on missing typescript-language-features (#976)
- fix: send "untitled:///" specifiers to the LSP (#978)
- fix: show error message for workspace init failure (#980)
- chore: deprecate "deno.*" mirror settings (#981)

### [3.26.0](https://github.com/denoland/vscode_deno/compare/3.25.1...3.26.0) / 2023.10.10

- fix: update lockfile schema to v3 (#965)
- feat: add deno tasks sidebar (#958)

### [3.25.1](https://github.com/denoland/vscode_deno/compare/3.25.0...3.25.1) / 2023.10.04

- fix: increase client shutdown timeout from 2s to 10s (#954)

### [3.25.0](https://github.com/denoland/vscode_deno/compare/3.24.0...3.25.0) / 2023.09.27

- docs: fix hyperlink to the Deno Language Server manual (#945)
- fix: append index to status requests (#946)
- feat: register notebook cells with the language client (#949)

### [3.24.0](https://github.com/denoland/vscode_deno/compare/3.23.1...3.24.0) / 2023.09.25

- fix: regression when caching via the command palette (#930)
- feat: include "javascript" and "typescript" settings in LSP init options (#929)

### [3.23.1](https://github.com/denoland/vscode_deno/compare/3.23.0...3.23.1) / 2023.09.19

- fix: provide args to deno.cache on cache-on-save (#924)

### [3.23.0](https://github.com/denoland/vscode_deno/compare/3.22.0...3.23.0) / 2023.09.19

- fix: getCompilerOptionsDiagnostics and getNavigateToItems fixed when "deno.enable" is false (#915)
- feat: Restore "deno.enable" null default for deno.json auto-detection (#921)
- feat: feat: "deno.disablePaths" setting (#919)

### [3.22.0](https://github.com/denoland/vscode_deno/compare/3.21.0...3.22.0) / 2023.09.08

- fix: properly detect 1.37.0 (#911)
- fix: default "deno.enable" to false temporarily (#913)
- feat: remove dead "deno.testing.enable" setting (#912)

### [3.21.0](https://github.com/denoland/vscode_deno/compare/3.20.0...3.21.0) / 2023.09.05

- fix: run only the clicked test via code lens (#798)
- fix: delete renamed test steps (#898)
- fix: check for existing commands before registering them (#905)
- feat: add redirects to lockfile schema (#894)
- feat: allow --inspect-wait when debugging test (#893)

- feat: enable via config file detection (#902)

  This will only activate with Deno 1.37.0 installed, which is unreleased as of
  writing. Removes the prompt added in
  [3.12.0](https://github.com/denoland/vscode_deno/blob/main/CHANGELOG.md#3120--20220330)
  since it's superseded by this feature.

### [3.20.0](https://github.com/denoland/vscode_deno/compare/3.19.1...3.20.0) / 2023.08.03

- fix: respect user's answers for enabling or disabling lint and the unstable
  flag during workspace initialization (#799)
- feat: cache on save (#831, #877)
- feat: Refreshed icon (#869)
- feat: show output panel on status bar click (#861)

### [3.19.1](https://github.com/denoland/vscode_deno/compare/3.19.0...3.19.1) / 2023.05.24

- fix: update default import suggestions (#854)

### [3.19.0](https://github.com/denoland/vscode_deno/compare/3.18.0...3.19.0) / 2023.05.23

- feat: ability to increase typescript isolate's max memory (#848)

### [3.18.0](https://github.com/denoland/vscode_deno/compare/3.17.0...3.18.0) / 2023.05.12

- feat: configurable document preload limit (#846)

### [3.17.0](https://github.com/denoland/vscode_deno/compare/3.16.0...3.17.0) / 2023.01.28

Revert "feat: enable inlay hints by default" (#794)

### [3.16.0](https://github.com/denoland/vscode_deno/compare/3.15.0...3.16.0) / 2023.01.04

- feat: Add lockfile schema (#766)
- feat: Make `--inspect-brk` default in older versions of Deno (#779)
- feat: Make `--inspect-wait` default when creating debug config (#775)
- feat: Use "node" launch type instead of "pwa-node" (#758)

### [3.15.0](https://github.com/denoland/vscode_deno/compare/3.14.1...3.15.0) / 2022.12.14

feat: enable inlay hints by default (#759)

### [3.14.1](https://github.com/denoland/vscode_deno/compare/3.14.0...3.14.1) / 2022.11.11

- fix: `enablePaths` on Windows (#745)

### [3.14.0](https://github.com/denoland/vscode_deno/compare/3.13.2...3.14.0) / 2022.10.26

- feat: add inlay hint settings (#733)

  With versions of Deno that support it (Release 1.27 and later), the extension
  now support configuring inlay hints for Deno enabled projects. The settings
  are controlled via `deno.inlayHints` and are off by default.

- fix: send inlay hints config on init (#740)

### [3.13.2](https://github.com/denoland/vscode_deno/compare/3.13.1...3.13.2) / 2022.10.09

- fix: deno/tasks expects no parameters (#722)
- fix: exclude demo image from extension package (#711)

### [3.13.1](https://github.com/denoland/vscode_deno/compare/3.13.0...3.13.1) / 2022.07.22

- fix: catch errors while fetching config tasks from language server (#669)

### [3.13.0](https://github.com/denoland/vscode_deno/compare/3.12.0...3.13.0) / 2022.06.27

- feat: don't write configuration to settings.json if values are default (#666)
- feat: enable lint by default (#665)

- fix: do not start lsp or show any messages if `deno` not found and not in a
  Deno project (#683)
- fix: resolve `deno` command from the default install location if it's not on
  the PATH (#684)

### [3.12.0](https://github.com/denoland/vscode_deno/compare/3.11.0...3.12.0) / 2022.03.30

- feat: prompt for enabling when config detected (#640)

  When a `deno.json` or `deno.jsonc` is detected in the root of a workspace or
  workspace folder and Deno isn't explicitly enabled or disabled, a prompt will
  appear to choose to enable the workspace (or workspace folder).

- feat: support config file tasks (#641)

  When a Deno configuration file (`deno.json`/`deno.jsonc`) applies to a
  workspace, and the Deno language server supports the task detection feature,
  tasks from the configuration file will be available in VSCode.

- feat: support vscode Testing API (#629)

  When the Deno language server supports the experimental testing API, tests
  will be made available in the Testing Explorer pane and other decorations
  individual tests in the code.

### [3.11.0](https://github.com/denoland/vscode_deno/compare/3.10.1...3.11.0) / 2022.03.21

- feat: support certificate related options (#612)

  Options are now supported to provide the Deno language server with custom TLS
  certificate information as well as unsafely ignore invalid TLS certificates,
  which are currently supported on the command line. This allows the extension
  to cache modules in custom certificate TLS environments from the editor.

- feat: support Deno enabling specified workspace paths (#635)

  When used with a version of the Deno language server that supports the same
  feature, specified folders (and their sub folders) can be _Deno enabled_
  leaving the remaining folders in the workspace using the built-in
  JavaScript/TypeScript language server. This feature is set using the _Deno:
  Enable Paths_ setting or `"deno.enablePaths"` if editing settings directly.

- fix: utilize fresh objects when muting built in ls (#615)
- fix: send all workspace settings during initialization (#632)

### [3.10.1](https://github.com/denoland/vscode_deno/compare/3.10.0...3.10.1) / 2022.01.16

- fix: update nest.land registry (#602)

### [3.10.0](https://github.com/denoland/vscode_deno/compare/3.9.2...3.10.0) / 2022.01.05

- feat: enable known registries by default (#594)

  Known registries which support completions suggestions in the editor
  (`deno.land`, `crux.land`, `nest.land`) are now enabled by default, making it
  easier to discover packages.

- feat: support the inspect option for `Deno.test` (#598)

  This allows the code lens for the `Debug` command to execute a test in debug
  mode.

- chore: update min version (#596)

### [3.9.2](https://github.com/denoland/vscode_deno/compare/3.9.1...3.9.2) / 2021.11.09

- fix: add back bundling and ensure CI uses same version of vsce for all steps
  (#545)
- fix: configurable import maps for testing code lens (#551)
- fix: use workspace root as current directory for executing test code lens
  (#564)
- fix: do not cache unsupported origins in config (#571)

### [3.9.1](https://github.com/denoland/vscode_deno/compare/3.9.0...3.9.1) / 2021.09.15

- revert: bundling related changes (#543)

### [3.9.0](https://github.com/denoland/vscode_deno/compare/3.8.1...3.9.0) / 2021.09.15

- feat: support deno.json(c) files (#521)

  As of 1.14 Deno supports an expanded set of configuration options in the
  configuration file above the supported TypeScript `"compilerOptions"` options.

  The extension supports validating these configuration files, as well as
  recommends naming them `deno.json` or `deno.jsonc`.

- fix: debug config provider (#513)
- fix: better suppression of built in diagnostics (#514)
- chore: bundle extension (#506)

  This decreases download/install size of the extension as well as speeds up
  load time of the extension.

- chore: fix packaging of extension (#507)
- chore: update vscode typings (#519)

### [3.8.1](https://github.com/denoland/vscode_deno/compare/3.8.0...3.8.1) / 2021.08.25

- fix: properly parse config for test code lens (#502)
- chore: bump minimum version of Deno CLI (#503)

### [3.8.0](https://github.com/denoland/vscode_deno/compare/3.7.0...3.8.0) / 2021.08.10

- feat: add ability to set cache directory in settings (#477)

  The plugin supports setting the `deno.cache` option, which allows setting a
  specific cache directory for the Deno language server to use. This is similar
  to the `DENO_DIR` environment variable that can be set when invoking Deno on
  the command line.

- feat: hide the status bar unless `deno.enable` is true (#485)

  The Deno language server runs in a workspace even when the project isn't
  enabled for Deno, as the formatting services are still available and the
  language server needs to keep track of the state of documents in case the
  workspace does become enabled. It is confusing to see the version of Deno in
  the status bar. The extension now will not display this information unless the
  workspace is enabled for Deno.

- fix: properly handle plugin configuration at startup (#474)

  This led to an issue where if Deno started before the built in TypeScript
  language service in a Deno enabled project, the TypeScript language service
  diagnostics were not _muted_ and incorrect or duplicate diagnostics were being
  displayed.

### [3.7.0](https://github.com/denoland/vscode_deno/compare/3.6.1...3.7.0) / 2021.07.02

- feat: add support for import map in test code lens (#446)

  When using the test code lens, the configuration of the import map is
  reflected in running the test.

- fix: activate extension on markdown / json / jsonc (#447)
- fix: setting then clearing "deno.path" config should not use empty string for
  path (#452)
- fix: better handling when language server fails to start (#454)

### [3.6.1](https://github.com/denoland/vscode_deno/compare/3.6.0...3.6.1) / 2021.06.08

- fix: update packaging and pin vsce version (#440)

### [3.6.0](https://github.com/denoland/vscode_deno/compare/3.5.1...3.6.0) / 2021.06.08

- feat: add support for tasks and test code lens (#436)

  The Deno Language Server as of Deno 1.11, code lenses for test are sent to the
  client, and the extension now supports allowing those tests to be run in the
  IDE. In addition, several tasks have been added to the extension which allow
  users to setup and configure common Deno CLI tasks via the `tasks.json`.
  Checkout out the [testing](./docs/testing.md) and [tasks](./docs/tasks.md)
  documentation for more information.

### [3.5.1](https://github.com/denoland/vscode_deno/compare/3.5.0...3.5.1) / 2021.06.02

- fix: bump semver of extension (#429)

  This informs users that they require Deno 1.10.3 or later for the extension to
  properly work.

### [3.5.0](https://github.com/denoland/vscode_deno/compare/3.4.0...3.5.0) / 2021.06.01

- feat: recognize JSON(C) and markdown files (#404)

  This allows the Deno language server to be used as a formatter for JSON(C) and
  markdown files.

### [3.4.0](https://github.com/denoland/vscode_deno/compare/3.3.0...3.4.0) / 2021.05.11

- feat: handle per resource configuration (#411)

  Along with Deno v1.10, the extension now supports vscode's multi-root
  workspaces, which will allow you to enable and disable Deno per workspace
  folder.

- feat: add `internalDebug` config flag (#406)

  Enabling `deno.internalDebug` to `true` will output additional (quite verbose)
  logging information to help with diagnosing language server issues. This
  requires Deno v1.10 or later to work.

- fix: activate on `reloadImportRegistries` command (#407)
- docs: fix type in `ImportCompletions.md` (#410)

### [3.3.0](https://github.com/denoland/vscode_deno/compare/3.2.0...3.3.0) / 2021.04.13

- feat: add support for import registry completions (#380)
- feat: add restart language server command (#385)
- feat: add version notification message (#383)
- feat: support for relative path resolution (using workspaces) in deno.path
  (#381)

### [3.2.0](https://github.com/denoland/vscode_deno/compare/3.1.0...3.2.0) / 2021.03.15

- feat: read-add debug support (#351)
- feat: add settings to affect completions (#368)
- fix: manual `deno` command resolution on windows (#367)

### [3.1.0](https://github.com/denoland/vscode_deno/compare/3.0.1...3.1.0) / 2021.03.02

- feat: add deno.path setting (#350)
- fix: activate extension on command (#336)
- chore: move Releases.md to CHANGELOG.md for better marketplace integration
  (#344)
- docs: recommend import_map.json instead of import-map.json (#340)

### [3.0.1](https://github.com/denoland/vscode_deno/compare/3.0.0...3.0.1) / 2021.02.19

- fix: EXTENSION_ID corrected to denoland.vscode-deno extension (#333)

### [3.0.0](https://github.com/denoland/vscode_deno/compare/canary/0.0.10...3.0.0) / 2021.02.19

Canary has been released as the main extension. Use Deno 1.7.5 or later.

- chore: README improvements (#331)
- feat: use preview instead of display for status (#330)
- feat: add a welcome screen for extension (#329)
- fix: typo in init command (#327)

### [canary/0.0.10](https://github.com/denoland/vscode_deno/compare/canary/0.0.9...canary/0.0.10) / 2021.02.13

- fix: don't remove required files when packaging vsix

### [canary/0.0.9](https://github.com/denoland/vscode_deno/compare/canary/0.0.8...canary/0.0.9) / 2021.02.13

- feat: add initialize workspace command (#316)
- feat: support deno cache quick fix (#322)
- feat: add implementations code lens configuration option (#319)
- chore: add screenshot to README (#323)

### [canary/0.0.8](https://github.com/denoland/vscode_deno/compare/canary/0.0.7...canary/0.0.8) / 2021.02.01

- feat: code lens for references (#308)
- feat: disable most of builtin language service when deno enabled (#307)

### [canary/0.0.7](https://github.com/denoland/vscode_deno/compare/canary/0.0.6...canary/0.0.7) / 2021.01.24

- feat: add back JSON schema for import maps (#283)
- feat: add deno cache command (#291)
- feat: plugin ignores getImplementation requests when Deno enabled (#302)
- feat: change textDocument/rename to use LSP (#292)
- fix: pass NO_COLOR when starting lsp (#293)

### [canary/0.0.6](https://github.com/denoland/vscode_deno/compare/canary/0.0.5...canary/0.0.6) / 2020.12.13

- fix: include typescript-deno-plugin in vsix (#285)

### [canary/0.0.5](https://github.com/denoland/vscode_deno/compare/canary/0.0.4...canary/0.0.5) / 2020.12.09

- chore: release on canary/* tag

### [canary/0.0.4](https://github.com/denoland/vscode_deno/compare/canary/0.0.3...canary/0.0.4) / 2020.12.09

- chore: disable built in completions (#279)

### [canary/0.0.3](https://github.com/denoland/vscode_deno/compare/v3.0.0-pre.1...canary/0.0.3) / 2020.12.08

- feat: suppresses quick info and document highlights (#266)
- feat: suppress references and definitions (#270)
- feat: extension activates on deno virtual files (#275)
- fix: Update version so it can be published on marketplace (#272)
- fix: plugin settings match language server settings (#276)

### [v3.0.0-pre.1](https://github.com/denoland/vscode_deno/compare/v2.3.3...v3.0.0-pre.1) / 2020.11.30

This is a full rewrite of the extension to use the upcoming `deno lsp` feature.

### [v2.3.3](https://github.com/denoland/vscode_deno/compare/v2.3.2...v2.3.3) / 2020.11.05

- chore: update compilation settings to match 1.5 (#251)

### [v2.3.2](https://github.com/denoland/vscode_deno/compare/v2.3.1...v2.3.2) / 2020.10.12

- chore: disable importsNotUsedAsValues --unstable default (#240)
- build: husky pre-commit hooks (#224)

### [v2.3.1](https://github.com/denoland/vscode_deno/compare/v2.3.0...v2.3.1) / 2020.09.24

- fix: enable recursive mode for mkdir of cache path (#232)

### [v2.3.0](https://github.com/denoland/vscode_deno/compare/v2.2.3...v2.3.0) / 2020.09.24

- feat: generic import intellisense (#219)
- feat: out of the box debug support (#221)
- feat: init project command to quickly set up .vscode/settings.json (#207)
- fix: `Fetch the module` quickfix does not respect deno.unstable setting (#213)
- chore: fix manual URL in hover card (#226)

### [v2.2.3](https://github.com/denoland/vscode_deno/compare/v2.2.2...v2.2.3) / 2020.09.13

- fix: failed to load typescript-deno-plugin error (#205)
- chore: align ignored diagnostics to Deno 1.4.0 (#205)

### [v2.2.2](https://github.com/denoland/vscode_deno/compare/v2.2.1...v2.2.2) / 2020.09.13

- chore: update tsconfig to match Deno 1.4.0 (#204)

### [v2.2.1](https://github.com/denoland/vscode_deno/compare/v2.2.0...v2.2.1) / 2020.09.09

- fix: remove ansi codes from install output (#185)
- fix: deno.land/x cache will always renew on vscode restart after 24 hours
  (#191)
- fix: ignore 'rule' for this line does not work on the first line (#192)
- build: release .vsix artifact during release (#195)

### [v2.2.0](https://github.com/denoland/vscode_deno/compare/v2.1.2...v2.2.0) / 2020.09.07

- feat: add inline `deno lint` diagnostics (#162)
- fix: add IntelliSense support for `export` (#184)
- refactor: move imports IntelliSense logic to server (#181)

### [v2.1.2](https://github.com/denoland/vscode_deno/compare/v2.1.1...v2.1.2) / 2020.09.04

- fix: another typescript not found error (#178)

### [v2.1.1](https://github.com/denoland/vscode_deno/compare/v2.1.0...v2.1.1) / 2020.09.04

- fix: typescript not found error (#177)

### [v2.1.0](https://github.com/denoland/vscode_deno/compare/v2.0.16...v2.1.0) / 2020.09.04

- feat: IntelliSense support for std and deno.land/x imports (#172)
- fix: add support for URLs with non default ports (#173)
- fix: correctly handle non existing \$DENO_DIR/deps (#169)
- refactor: simplify import map json validation (#167)
- chore: update dependencies (#165)
- docs: remove non english readme (#164)

### [v2.0.16](https://github.com/denoland/vscode_deno/compare/v2.0.15...v2.0.16) / 2020.08.29

- fix: autocomplete supports adding extensions (#156)
- docs: fix readme install description (#160)

### [v2.0.15](https://github.com/denoland/vscode_deno/compare/v2.0.14...v2.0.15) / 2020.08.28

- build: fix releasing extension to Visual Studio Marketplace from CI (#159)

### [v2.0.14](https://github.com/denoland/vscode_deno/compare/v2.0.13...v2.0.14) / 2020.08.25

- fix: fixActions not import Deno module URL correctly (#154)

### [v2.0.11-v2.0.13](https://github.com/denoland/vscode_deno/compare/v2.0.10...v2.0.13) / 2020.08.14

- fix: use the correct `typescript-deno-plugin` (#144)
- docs: update contributing instructions (#146)

### v2.0.0-v2.0.10 / 2020.08.13

Replacement of extension by the one written by @axetroy.

### v1.x / June 2020 - July 2020

Initial release of the extension originally written by @justjavac.

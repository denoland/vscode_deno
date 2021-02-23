# Change Log

Releases of the extension can be downloaded from
[Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=denoland.vscode-deno).

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

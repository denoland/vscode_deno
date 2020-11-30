# Releases

Releases of the extension can be downloaded from [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=denoland.vscode-deno).

### v3.0.0-pre.1 / 2020.11.30

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
- fix: deno.land/x cache will always renew on vscode restart after 24 hours (#191)
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

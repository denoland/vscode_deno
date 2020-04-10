import * as path from "path";

import merge from "deepmerge";
import ts_module from "typescript/lib/tsserverlibrary";

import { Logger } from "./logger";
import { ConfigurationManager, DenoPluginConfig } from "./configuration";
import { getDenoDts } from "../../core/deno";
import { ModuleResolver } from "../../core/module_resolver";
import { CacheModule } from "../../core/deno_cache";
import { pathExistsSync, normalizeFilepath } from "../../core/util";
import { normalizeImportStatement } from "../../core/deno_normalize_import_statement";
import { readConfigurationFromVscodeSettings } from "../../core/vscode_settings";
import { getImportModules } from "../../core/deno_deps";

const ignoredCompilerOptions: readonly string[] = [
  "allowSyntheticDefaultImports",
  "baseUrl",
  "build",
  "composite",
  "declaration",
  "declarationDir",
  "declarationMap",
  "diagnostics",
  "downlevelIteration",
  "emitBOM",
  "emitDeclarationOnly",
  "esModuleInterop",
  "extendedDiagnostics",
  "forceConsistentCasingInFileNames",
  "help",
  "importHelpers",
  "incremental",
  "inlineSourceMap",
  "inlineSources",
  "init",
  "isolatedModules",
  "listEmittedFiles",
  "listFiles",
  "mapRoot",
  "maxNodeModuleJsDepth",
  "module",
  "moduleResolution",
  "newLine",
  "noEmit",
  "noEmitHelpers",
  "noEmitOnError",
  "noLib",
  "noResolve",
  "out",
  "outDir",
  "outFile",
  "paths",
  "preserveSymlinks",
  "preserveWatchOutput",
  "pretty",
  "rootDir",
  "rootDirs",
  "showConfig",
  "skipDefaultLibCheck",
  "skipLibCheck",
  "sourceMap",
  "sourceRoot",
  "stripInternal",
  "target",
  "traceResolution",
  "tsBuildInfoFile",
  "types",
  "typeRoots",
  "version",
  "watch",
];

export class DenoPlugin implements ts_module.server.PluginModule {
  // plugin name
  static readonly PLUGIN_NAME = "typescript-deno-plugin";
  private readonly configurationManager = new ConfigurationManager();
  // see https://github.com/denoland/deno/blob/2debbdacb935cfe1eb7bb8d1f40a5063b339d90b/js/compiler.ts#L159-L170
  private readonly DEFAULT_OPTIONS: ts_module.CompilerOptions = {
    allowJs: true,
    checkJs: false,
    strict: true,
    esModuleInterop: true,
    jsx: this.typescript.JsxEmit.React,
    module: this.typescript.ModuleKind.ESNext,
    moduleResolution: this.typescript.ModuleResolutionKind.NodeJs,
    outDir: "$deno$",
    resolveJsonModule: true,
    sourceMap: true,
    stripComments: true,
    target: this.typescript.ScriptTarget.ESNext,
    noEmit: true,
    noEmitHelpers: true,
  };
  // No matter how tsconfig.json is set in the working directory
  // It will always overwrite the configuration
  private readonly MUST_OVERWRITE_OPTIONS: ts_module.CompilerOptions = {
    jsx: this.DEFAULT_OPTIONS.jsx,
    module: this.DEFAULT_OPTIONS.module,
    moduleResolution: this.DEFAULT_OPTIONS.moduleResolution,
    resolveJsonModule: this.DEFAULT_OPTIONS.resolveJsonModule,
    strict: this.DEFAULT_OPTIONS.strict,
    noEmit: this.DEFAULT_OPTIONS.noEmit,
    noEmitHelpers: this.DEFAULT_OPTIONS.noEmitHelpers,
    target: this.typescript.ScriptTarget.ESNext,
  };
  private logger!: Logger;

  constructor(private readonly typescript: typeof ts_module) {}

  create(info: ts_module.server.PluginCreateInfo): ts_module.LanguageService {
    const { project, languageService, languageServiceHost } = info;
    const projectDirectory = project.getCurrentDirectory();

    // TypeScript plugins have a `cwd` of `/`, which causes issues with import resolution.
    process.chdir(projectDirectory);

    this.logger = Logger.forPlugin(DenoPlugin.PLUGIN_NAME, info);

    this.logger.info(`Create typescript-deno-plugin`);
    const getCompilationSettings = languageServiceHost.getCompilationSettings.bind(
      languageServiceHost
    );
    const getScriptFileNames = languageServiceHost.getScriptFileNames.bind(
      languageServiceHost
    );
    // ref https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API#customizing-module-resolution
    const resolveModuleNames = languageServiceHost.resolveModuleNames?.bind(
      languageServiceHost
    );
    const getSemanticDiagnostics = languageService.getSemanticDiagnostics.bind(
      languageService
    );

    const resolveTypeReferenceDirectives = languageServiceHost.resolveTypeReferenceDirectives?.bind(
      languageServiceHost
    );

    const getCompletionEntryDetails = languageService.getCompletionEntryDetails.bind(
      languageService
    );

    languageServiceHost.getCompilationSettings = () => {
      const projectConfig = getCompilationSettings();

      if (!this.configurationManager.config.enable) {
        return projectConfig;
      }

      // delete the option which ignore by Deno
      // see https://github.com/denoland/deno/blob/bced52505f/cli/js/compiler/host.ts#L65-L121
      for (const option in projectConfig) {
        if (ignoredCompilerOptions.includes(option)) {
          delete projectConfig[option];
        }
      }

      const compilationSettings = merge(
        merge(this.DEFAULT_OPTIONS, projectConfig),
        this.MUST_OVERWRITE_OPTIONS
      );

      return compilationSettings;
    };

    languageServiceHost.getScriptFileNames = () => {
      const scriptFileNames = getScriptFileNames();

      if (!this.configurationManager.config.enable) {
        return scriptFileNames;
      }

      // Get typescript declaration File
      const dtsFiles = [getDenoDts()];

      const iterator = new Set(dtsFiles).entries();

      for (const [, filepath] of iterator) {
        scriptFileNames.push(filepath);
      }

      return scriptFileNames;
    };

    if (resolveTypeReferenceDirectives) {
      languageServiceHost.resolveTypeReferenceDirectives = (
        typeDirectiveNames: string[],
        containingFile: string,
        ...rest
      ) => {
        if (!this.configurationManager.config.enable) {
          return resolveTypeReferenceDirectives(
            typeDirectiveNames,
            containingFile,
            ...rest
          );
        }

        const realpath = project.realpath;

        // in Windows.
        // containingFile may be a unix-like style
        // eg. c:/Users/admin/path/to/file.ts
        // This is not a legal file path in Windows
        // It will cause a series of bugs, so here we get the real file path
        let realContainingFile = realpath
          ? realpath(containingFile)
          : containingFile;

        // containingFile may be `untitled: ^ Untitled-1`
        // This is not a valid file path and may cause the typescript server to crash
        if (/^untitled:/.test(realContainingFile)) {
          realContainingFile = project.getCurrentDirectory();
        }

        if (!this.typescript.sys.fileExists(realContainingFile)) {
          return [];
        }

        const importMapsFilepath = this.configurationManager.config.import_map
          ? path.isAbsolute(this.configurationManager.config.import_map)
            ? this.configurationManager.config.import_map
            : path.resolve(
                project.getCurrentDirectory(),
                this.configurationManager.config.import_map
              )
          : undefined;

        const resolver = ModuleResolver.create(
          realContainingFile,
          importMapsFilepath
        );

        const result: (
          | ts_module.ResolvedTypeReferenceDirective
          | undefined
        )[] = [];

        for (const typeDirectiveName of typeDirectiveNames) {
          const [resolvedModule] = resolver.resolveModules([typeDirectiveName]);

          // if module found. then return the module file
          if (resolvedModule) {
            const target: ts_module.ResolvedTypeReferenceDirective = {
              primary: false,
              resolvedFileName: resolvedModule.filepath,
            };

            result.push(target);
            continue;
          }

          // If the module does not exist, then apply the native reference method
          const [target] = resolveTypeReferenceDirectives(
            [typeDirectiveName],
            containingFile,
            ...rest
          );

          result.push(target);
        }

        return result;
      };
    }

    languageService.getSemanticDiagnostics = (filename: string) => {
      const diagnostics = getSemanticDiagnostics(filename);

      if (!this.configurationManager.config.enable) {
        return diagnostics;
      }

      // ref: https://github.com/denoland/deno/blob/da8cb408c878aa6e90542e26173f1f14b5254d29/cli/js/compiler/util.ts#L262
      const ignoredDiagnostics = [
        // TS2306: File 'file:///Users/rld/src/deno/cli/tests/subdir/amd_like.js' is
        // not a module.
        2306,
        // TS1375: 'await' expressions are only allowed at the top level of a file
        // when that file is a module, but this file has no imports or exports.
        // Consider adding an empty 'export {}' to make this file a module.
        1375,
        // TS1103: 'for-await-of' statement is only allowed within an async function
        // or async generator.
        1103,
        // TS2691: An import path cannot end with a '.ts' extension. Consider
        // importing 'bad-module' instead.
        2691,
        // TS5009: Cannot find the common subdirectory path for the input files.
        5009,
        // TS5055: Cannot write file
        // 'http://localhost:4545/cli/tests/subdir/mt_application_x_javascript.j4.js'
        // because it would overwrite input file.
        5055,
        // TypeScript is overly opinionated that only CommonJS modules kinds can
        // support JSON imports.  Allegedly this was fixed in
        // Microsoft/TypeScript#26825 but that doesn't seem to be working here,
        // so we will ignore complaints about this compiler setting.
        5070,
        // TS7016: Could not find a declaration file for module '...'. '...'
        // implicitly has an 'any' type.  This is due to `allowJs` being off by
        // default but importing of a JavaScript module.
        7016,
      ];

      return diagnostics.filter((v) => !ignoredDiagnostics.includes(v.code));
    };

    languageService.getCompletionEntryDetails = (
      fileName: string,
      position: number,
      name: string,
      formatOptions?:
        | ts_module.FormatCodeOptions
        | ts_module.FormatCodeSettings,
      source?: string,
      preferences?: ts_module.UserPreferences
    ) => {
      const details = getCompletionEntryDetails(
        fileName,
        position,
        name,
        formatOptions,
        source,
        preferences
      );

      if (!this.configurationManager.config.enable) {
        return details;
      }

      if (details) {
        // modifiers maybe contain multiple values. eg `export,declare`
        const modifiers = details.kindModifiers.split(",") || [];

        if (
          modifiers.includes("export") &&
          details.codeActions &&
          details.codeActions.length
        ) {
          for (const ca of details.codeActions) {
            for (const change of ca.changes) {
              if (!change.isNewFile) {
                for (const tc of change.textChanges) {
                  tc.newText = normalizeImportStatement(
                    fileName,
                    tc.newText,
                    this.logger
                  );
                }
              }
            }
          }
        }

        if (details.source && details.source.length) {
          for (const source of details.source) {
            if (source.kind === "text") {
              // text is always unix style
              const text = source.text;

              const absoluteFilepath = path.resolve(
                normalizeFilepath(path.dirname(fileName)),
                normalizeFilepath(text)
              );

              if (path.isAbsolute(absoluteFilepath)) {
                const denoCache = CacheModule.create(
                  absoluteFilepath,
                  this.logger
                );

                if (denoCache) {
                  source.text = denoCache.url.href;
                }
              }
            }
          }
        }
      }

      return details;
    };

    if (resolveModuleNames) {
      languageServiceHost.resolveModuleNames = (
        moduleNames: string[],
        containingFile: string,
        ...rest
      ): (
        | ts_module.ResolvedModule
        | ts_module.ResolvedModuleFull
        | undefined
      )[] => {
        if (!this.configurationManager.config.enable) {
          return resolveModuleNames(moduleNames, containingFile, ...rest);
        }

        const realpath = project.realpath;

        // in Windows.
        // containingFile may be a unix-like style
        // eg. c:/Users/admin/path/to/file.ts
        // This is not a legal file path in Windows
        // It will cause a series of bugs, so here we get the real file path
        let realContainingFile = realpath
          ? realpath(containingFile)
          : containingFile;

        // containingFile may be `untitled: ^ Untitled-1`
        // This is not a valid file path and may cause the typescript server to crash
        if (/^untitled:/.test(realContainingFile)) {
          realContainingFile = project.getCurrentDirectory();
        }

        const importMapsFilepath = this.configurationManager.config.import_map
          ? path.isAbsolute(this.configurationManager.config.import_map)
            ? this.configurationManager.config.import_map
            : path.resolve(
                project.getCurrentDirectory(),
                this.configurationManager.config.import_map
              )
          : undefined;

        const resolver = ModuleResolver.create(
          realContainingFile,
          importMapsFilepath
        );

        const content = this.typescript.sys.readFile(containingFile, "utf8");

        // handle @deno-types
        if (content && content.indexOf("// @deno-types=") >= 0) {
          const sourceFile = this.typescript.createSourceFile(
            containingFile,
            content,
            this.typescript.ScriptTarget.ESNext,
            true
          );

          const modules = getImportModules(this.typescript)(sourceFile);

          for (const m of modules) {
            if (m.hint) {
              const index = moduleNames.findIndex((v) => v === m.moduleName);

              moduleNames[index] = m.hint.text;
            }
          }
        }

        const resolvedModules = resolver.resolveModules(moduleNames);

        // try resolve typeReferenceDirectives
        for (const resolvedModule of resolvedModules) {
          if (!resolvedModule) {
            continue;
          }

          const content = this.typescript.sys.readFile(resolvedModule.filepath);

          if (!content) {
            continue;
          }

          const { typeReferenceDirectives } = this.typescript.preProcessFile(
            content,
            true,
            true
          );

          if (!typeReferenceDirectives.length) {
            continue;
          }

          const _resolver = ModuleResolver.create(
            resolvedModule.filepath,
            importMapsFilepath
          );

          const modules = _resolver.resolveModules(
            typeReferenceDirectives.map((v) => v.fileName)
          );

          for (const m of modules) {
            if (m) {
              resolvedModule.origin = m.origin;
              resolvedModule.module = m.module;
              resolvedModule.filepath = m.filepath;
            }
          }
        }

        return resolveModuleNames(
          resolvedModules.map((v, index) =>
            v ? v.module : moduleNames[index]
          ),
          containingFile,
          ...rest
        ).map((v, index) => {
          if (!v) {
            const cacheModule = resolvedModules[index];
            if (cacheModule) {
              const moduleFilepath = cacheModule.filepath;
              // import * as React from 'https://dev.jspm.io/react'
              if (
                path.isAbsolute(moduleFilepath) &&
                pathExistsSync(moduleFilepath)
              ) {
                const result: ts_module.ResolvedModuleFull = {
                  extension: cacheModule.extension,
                  isExternalLibraryImport: false,
                  resolvedFileName: moduleFilepath,
                } as ts_module.ResolvedModuleFull;

                return result;
              }
            }
          }

          return v;
        });
      };
    }

    const vscodeSettings = readConfigurationFromVscodeSettings(
      projectDirectory
    );

    if (vscodeSettings) {
      this.configurationManager.update(vscodeSettings);
    }

    this.configurationManager.onUpdatedConfig(() => {
      project.refreshDiagnostics();
      project.updateGraph();
      languageService.getProgram()?.emit();
    });

    return languageService;
  }

  onConfigurationChanged(c: DenoPluginConfig) {
    this.logger.info(`onConfigurationChanged: ${JSON.stringify(c)}`);
    this.configurationManager.update(c);
  }
}

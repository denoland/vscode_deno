import * as path from "path";

import merge from "deepmerge";
import ts_module from "typescript/lib/tsserverlibrary";

import { Logger } from "./logger";
import { ConfigurationManager, DenoPluginConfig } from "./configuration";
import { getDenoDts } from "../../core/deno";
import { ModuleResolver, ResolvedModule } from "../../core/module_resolver";
import { pathExistsSync } from "../../core/util";
import { normalizeImportStatement } from "../../core/deno_normalize_import_statement";
import { readConfigurationFromVscodeSettings } from "../../core/vscode_settings";

export class DenoPlugin implements ts_module.server.PluginModule {
  // plugin name
  static readonly PLUGIN_NAME = "typescript-deno-plugin";
  private readonly configurationManager = new ConfigurationManager();
  private ready = false;
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
    noEmitHelpers: true
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
    noEmitHelpers: this.DEFAULT_OPTIONS.noEmitHelpers
  };
  private logger!: Logger;

  constructor(private readonly typescript: typeof ts_module) {}

  create(info: ts_module.server.PluginCreateInfo): ts_module.LanguageService {
    const projectDirectory = info.project.getCurrentDirectory();

    // TypeScript plugins have a `cwd` of `/`, which causes issues with import resolution.
    process.chdir(projectDirectory);

    this.configurationManager.onUpdatedConfig(() => {
      if (this.ready) {
        info.project.refreshDiagnostics();
        info.project.updateGraph();
        info.languageService.getProgram()?.emit();
      }
    });

    this.logger = Logger.forPlugin(DenoPlugin.PLUGIN_NAME, info);

    const vscodeSettings = readConfigurationFromVscodeSettings(
      projectDirectory
    );

    if (vscodeSettings) {
      this.configurationManager.update(vscodeSettings);
    }

    this.logger.info(`Create typescript-deno-plugin`);
    const getCompilationSettings = info.languageServiceHost.getCompilationSettings.bind(
      info.languageServiceHost
    );
    const getScriptFileNames = info.languageServiceHost.getScriptFileNames.bind(
      info.languageServiceHost
    );
    // ref https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API#customizing-module-resolution
    const resolveModuleNames = info.languageServiceHost.resolveModuleNames?.bind(
      info.languageServiceHost
    );
    const getSemanticDiagnostics = info.languageService.getSemanticDiagnostics.bind(
      info.languageService
    );

    const resolveTypeReferenceDirectives = info.languageServiceHost.resolveTypeReferenceDirectives?.bind(
      info.languageServiceHost
    );

    const getCompletionEntryDetails = info.languageService.getCompletionEntryDetails.bind(
      info.languageService
    );

    info.languageServiceHost.getCompilationSettings = () => {
      const projectConfig = getCompilationSettings();

      if (!this.configurationManager.config.enable) {
        return projectConfig;
      }

      const compilationSettings = merge(
        merge(this.DEFAULT_OPTIONS, projectConfig),
        this.MUST_OVERWRITE_OPTIONS
      );

      this.logger.info(
        `compilationSettings:${JSON.stringify(compilationSettings)}`
      );
      return compilationSettings;
    };

    info.languageServiceHost.getScriptFileNames = () => {
      const scriptFileNames = getScriptFileNames();

      if (!this.configurationManager.config.enable) {
        return scriptFileNames;
      }

      // Get typescript declaration File
      const dtsFiles = [getDenoDts()]
        .concat(this.configurationManager.config.dts_file || [])
        .map(filepath => {
          const absoluteFilepath = path.isAbsolute(filepath)
            ? filepath
            : path.resolve(info.project.getCurrentDirectory(), filepath);
          return absoluteFilepath;
        })
        .filter(v => v.endsWith(this.typescript.Extension.Dts));

      const iterator = new Set(dtsFiles).entries();

      for (const [, filepath] of iterator) {
        scriptFileNames.push(filepath);
      }

      return scriptFileNames;
    };

    if (resolveTypeReferenceDirectives) {
      info.languageServiceHost.resolveTypeReferenceDirectives = (
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

        const realpath = info.project.realpath;

        // in Windows.
        // containingFile may be a unix-like style
        // eg. c:/Users/admin/path/to/file.ts
        // This is not a legal file path in Windows
        // It will cause a series of bugs, so here we get the real file path
        const realContainingFile = realpath
          ? realpath(containingFile)
          : containingFile;

        const importMapsFilepath = this.configurationManager.config.import_map
          ? path.isAbsolute(this.configurationManager.config.import_map)
            ? this.configurationManager.config.import_map
            : path.resolve(
                info.project.getCurrentDirectory(),
                this.configurationManager.config.import_map
              )
          : undefined;

        const resolver = ModuleResolver.create(
          realContainingFile,
          importMapsFilepath
        );

        const resolvedModules = resolver
          .resolveModules(typeDirectiveNames)
          .filter(v => v) as ResolvedModule[];

        return resolveTypeReferenceDirectives(
          resolvedModules.map(v => v.module),
          containingFile,
          ...rest
        );
      };
    }

    info.languageService.getSemanticDiagnostics = (filename: string) => {
      const diagnostics = getSemanticDiagnostics(filename);

      if (!this.configurationManager.config.enable) {
        return diagnostics;
      }

      const ignoreCodeMapInDeno: { [k: number]: boolean } = {
        2691: true, // can not import module which end with `.ts`
        1308: true, // support top level await below typescript 3.8.0
        1378: true, // support top level await in typescript^3.8.0
        1103: true // support `for of await`
      };

      return diagnostics.filter(v => {
        return !ignoreCodeMapInDeno[v.code];
      });
    };

    info.languageService.getCompletionEntryDetails = (
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
        if (details.codeActions && details.codeActions.length) {
          for (const ca of details.codeActions) {
            for (const change of ca.changes) {
              if (!change.isNewFile) {
                for (const tc of change.textChanges) {
                  tc.newText = normalizeImportStatement(tc.newText);
                }
              }
            }
          }
        }
      }

      return details;
    };

    if (resolveModuleNames) {
      info.languageServiceHost.resolveModuleNames = (
        moduleNames: string[],
        containingFile: string,
        ...rest
      ): (ts_module.ResolvedModule | undefined)[] => {
        if (!this.configurationManager.config.enable) {
          return resolveModuleNames(moduleNames, containingFile, ...rest);
        }

        const realpath = info.project.realpath;

        // in Windows.
        // containingFile may be a unix-like style
        // eg. c:/Users/admin/path/to/file.ts
        // This is not a legal file path in Windows
        // It will cause a series of bugs, so here we get the real file path
        const realContainingFile = realpath
          ? realpath(containingFile)
          : containingFile;

        const importMapsFilepath = this.configurationManager.config.import_map
          ? path.isAbsolute(this.configurationManager.config.import_map)
            ? this.configurationManager.config.import_map
            : path.resolve(
                info.project.getCurrentDirectory(),
                this.configurationManager.config.import_map
              )
          : undefined;

        const resolver = ModuleResolver.create(
          realContainingFile,
          importMapsFilepath
        );

        const resolvedModules = resolver.resolveModules(moduleNames);

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
                return {
                  extension: this.typescript.Extension.Js,
                  isExternalLibraryImport: false,
                  resolvedFileName: moduleFilepath
                } as ts_module.ResolvedModuleFull;
              }
            }
          }

          return v;
        });
      };
    }

    this.ready = true;

    return info.languageService;
  }

  onConfigurationChanged(c: DenoPluginConfig) {
    this.logger.info(`onConfigurationChanged: ${JSON.stringify(c)}`);
    this.configurationManager.update(c);
  }
}

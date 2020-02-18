import * as path from "path";

import merge from "deepmerge";
import ts_module from "typescript/lib/tsserverlibrary";

import { Logger } from "./logger";
import { ModuleResolver } from "./module_resolver";
import { Deno } from "./deno";
import { ConfigurationManager, DenoPluginConfig } from "./configuration";
import { pathExistsSync } from "./util";

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
    const directory = info.project.getCurrentDirectory();

    // TypeScript plugins have a `cwd` of `/`, which causes issues with import resolution.
    process.chdir(directory);

    this.configurationManager.onUpdatedConfig(() => {
      info.project.refreshDiagnostics();
      info.project.updateGraph();
    });

    this.logger = Logger.forPlugin(DenoPlugin.PLUGIN_NAME, info);

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
      const dtsFilepaths = Deno.declarationFile
        .concat(this.configurationManager.config.dts_file || [])
        .map(filepath => {
          const absoluteFilepath = path.isAbsolute(filepath)
            ? filepath
            : path.resolve(info.project.getCurrentDirectory(), filepath);
          return absoluteFilepath;
        })
        .filter(v => v.endsWith(".d.ts"));

      const iterator = new Set(dtsFilepaths).entries();

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

        const resolver = new ModuleResolver(
          containingFile,
          this.logger,
          info.project.getCurrentDirectory()
        );

        const modules = resolver.resolveModuleNames(typeDirectiveNames);

        return resolveTypeReferenceDirectives(
          modules.map(v => v.module),
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

    if (!resolveModuleNames) {
      this.logger.info("resolveModuleNames is undefined.");
      return info.languageService;
    }

    info.languageServiceHost.resolveModuleNames = (
      moduleNames: string[],
      containingFile: string,
      ...rest
    ): (ts_module.ResolvedModule | undefined)[] => {
      if (!this.configurationManager.config.enable) {
        return resolveModuleNames(moduleNames, containingFile, ...rest);
      }

      const resolver = new ModuleResolver(
        containingFile,
        this.logger,
        info.project.getCurrentDirectory(),
        this.configurationManager.config.import_map
      );

      const resolvedModules = resolver.resolveModuleNames(moduleNames);

      return resolveModuleNames(
        resolvedModules.map(v => v.module),
        containingFile,
        ...rest
      ).map((v, index) => {
        if (!v) {
          const moduleFilepath = resolvedModules[index].filepath;
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

          return v;
        }

        return v;
      });
    };

    return info.languageService;
  }

  onConfigurationChanged(c: DenoPluginConfig) {
    this.logger.info(`onConfigurationChanged: ${JSON.stringify(c)}`);
    this.configurationManager.update(c);
  }
}

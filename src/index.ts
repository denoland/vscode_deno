// modified from https://github.com/Microsoft/typescript-tslint-plugin
import path from "path";
import merge from "merge-deep";
import ts_module, {
  ResolvedModuleFull,
  CompilerOptions,
} from "typescript/lib/tsserverlibrary";
import { parseFromString, resolve, ImportMaps } from "import-maps";

import { Logger } from "./logger";
import {
  getGlobalDtsPath,
  getLocalDtsPath,
  getDtsPathForVscode,
  normalizeFilepath,
  pathExistsSync,
  getWebWorkderDtsPath,
} from "./utils";

import { universalModuleResolver } from "./module_resolver/universal_module_resolver";
import { readFileSync } from "fs";
import { URL } from "url";

let logger: Logger;
let pluginInfo: ts_module.server.PluginCreateInfo;

type DenoPluginConfig = {
  enable: boolean;
  importmap?: string;
  tsconfig?: string;
  dtsPath?: string;
};

const config: DenoPluginConfig = {
  enable: true,
};

module.exports = function init(
  { typescript }: { typescript: typeof ts_module },
) {
  // see https://github.com/denoland/deno/blob/2debbdacb935cfe1eb7bb8d1f40a5063b339d90b/js/compiler.ts#L159-L170
  const OPTIONS: CompilerOptions = {
    allowJs: true,
    checkJs: true,
    esModuleInterop: true,
    module: typescript.ModuleKind.ESNext,
    moduleResolution: typescript.ModuleResolutionKind.NodeJs,
    jsx: typescript.JsxEmit.React,
    noEmit: true,
    strict: true,
    outDir: "$deno$",
    removeComments: true,
    stripComments: true,
    resolveJsonModule: true,
    sourceMap: true,
    target: typescript.ScriptTarget.ESNext,
    typeRoots: [],
  };

  const OPTIONS_OVERWRITE_BY_DENO: CompilerOptions = {
    allowNonTsExtensions: false,
    jsx: OPTIONS.jsx,
    module: OPTIONS.module,
    moduleResolution: OPTIONS.moduleResolution,
    resolveJsonModule: OPTIONS.resolveJsonModule,
    strict: OPTIONS.strict,
    noEmit: OPTIONS.noEmit,
    noEmitHelpers: OPTIONS.noEmitHelpers,
    target: typescript.ScriptTarget.ESNext,
  };

  return {
    create(info: ts_module.server.PluginCreateInfo): ts_module.LanguageService {
      logger = Logger.forPlugin(info);
      logger.info("plugin created.");

      pluginInfo = info;
      const tsLs = info.languageService;
      const tsLsHost = info.languageServiceHost;
      const project = info.project;

      Object.assign(config, info.config);

      if (!config.enable) {
        logger.info("plugin disabled.");
        return tsLs;
      }

      const projectDirectory = project.getCurrentDirectory();
      // TypeScript plugins have a `cwd` of `/`, which causes issues with import resolution.
      process.chdir(projectDirectory);

      let parsedImportMap: ImportMaps | null = null;

      const resolveTypeReferenceDirectives =
        tsLsHost.resolveTypeReferenceDirectives;

      if (resolveTypeReferenceDirectives) {
        tsLsHost.resolveTypeReferenceDirectives = (
          typeDirectiveNames: string[],
          containingFile: string,
          redirectedReference: ts_module.ResolvedProjectReference | undefined,
          options: ts_module.CompilerOptions,
        ): (ts_module.ResolvedTypeReferenceDirective | undefined)[] => {
          const ret = resolveTypeReferenceDirectives.call(
            tsLsHost,
            typeDirectiveNames,
            containingFile,
            redirectedReference,
            options,
          );

          if (!config.enable) {
            logger.info("plugin disabled.");
            return ret;
          }

          return ret;
        };
      }

      // ref https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API#customizing-module-resolution
      const resolveModuleNames = tsLsHost.resolveModuleNames;

      if (resolveModuleNames) {
        tsLsHost.resolveModuleNames = (
          moduleNames: string[],
          containingFile: string,
          ...rest
        ) => {
          if (!config.enable) {
            logger.info("plugin disabled.");
            return resolveModuleNames.call(
              tsLsHost,
              moduleNames,
              containingFile,
              ...rest,
            );
          }

          const resolvedModules: (ResolvedModuleFull | undefined)[] = [];

          if (config.importmap != null) {
            parsedImportMap = parseImportMapFromFile(
              projectDirectory,
              config.importmap,
            );
          }

          // try resolve typeReferenceDirectives
          for (let moduleName of moduleNames) {
            if (parsedImportMap !== null) {
              try {
                const moduleUrl = resolve(
                  moduleName,
                  parsedImportMap,
                  new URL(projectDirectory, "file:///"),
                );
                moduleName = moduleUrl.protocol === "file:"
                  ? moduleUrl.pathname
                  : moduleUrl.href;
              } catch (e) {
                resolvedModules.push(undefined);
                continue;
              }
            }

            const resolvedModule = universalModuleResolver.resolve(
              moduleName,
              containingFile,
            );

            if (!resolvedModule) {
              resolvedModules.push(undefined);
              continue;
            }

            resolvedModules.push({
              extension: resolvedModule.extension as ts_module.Extension,
              isExternalLibraryImport: false,
              resolvedFileName: resolvedModule.filepath,
            });

            const content = typescript.sys.readFile(resolvedModule.filepath);

            if (!content) {
              continue;
            }

            const { typeReferenceDirectives } = typescript.preProcessFile(
              content,
              true,
              true,
            );

            if (!typeReferenceDirectives.length) {
              continue;
            }

            for (const typeRef of typeReferenceDirectives) {
              const module = universalModuleResolver.resolve(
                typeRef.fileName,
                containingFile,
              );
              if (module) {
                resolvedModule.originModuleName = module.originModuleName;
                resolvedModule.filepath = module.filepath;
              }
            }
          }

          return resolvedModules;
        };
      }

      const getCompilationSettings =
        info.languageServiceHost.getCompilationSettings;

      info.languageServiceHost.getCompilationSettings = () => {
        if (!config.enable) {
          return getCompilationSettings.call(tsLsHost);
        }

        const projectConfig = getCompilationSettings.call(
          info.languageServiceHost,
        );
        const compilationSettings = merge(
          merge(OPTIONS, projectConfig),
          OPTIONS_OVERWRITE_BY_DENO,
        );
        compilationSettings.baseUrl = projectDirectory;
        return compilationSettings;
      };

      const getScriptFileNames = info.languageServiceHost.getScriptFileNames!;
      info.languageServiceHost.getScriptFileNames = () => {
        if (!config.enable) {
          return getScriptFileNames.call(tsLsHost);
        }

        const scriptFileNames = getScriptFileNames.call(
          info.languageServiceHost,
        );

        const denoDtsPath = getDtsPathForVscode(info) ||
          getGlobalDtsPath() ||
          getLocalDtsPath(info.languageServiceHost);

        if (denoDtsPath) {
          scriptFileNames.push(denoDtsPath);
        }

        const webworkerDtsPath = getWebWorkderDtsPath(info.languageServiceHost);
        if (webworkerDtsPath) {
          scriptFileNames.push(webworkerDtsPath);
        }

        logger.info(`dts path:
          deno: ${denoDtsPath}
          webworker: ${webworkerDtsPath}
        `);

        return scriptFileNames;
      };

      function getCompletionEntryDetails(
        fileName: string,
        position: number,
        name: string,
        formatOptions:
          | ts_module.FormatCodeOptions
          | ts_module.FormatCodeSettings
          | undefined,
        source: string | undefined,
        preferences: ts_module.UserPreferences | undefined,
      ): ts_module.CompletionEntryDetails | undefined {
        const details = tsLs.getCompletionEntryDetails(
          fileName,
          position,
          name,
          formatOptions,
          source,
          preferences,
        );

        if (!config.enable) {
          return details;
        }

        if (details) {
          if (details.codeActions && details.codeActions.length) {
            for (const ca of details.codeActions) {
              for (const change of ca.changes) {
                if (!change.isNewFile) {
                  for (const tc of change.textChanges) {
                    tc.newText = tc.newText.replace(
                      /^(import .* from ['"])(\..*)(['"];\n)/i,
                      "$1$2.ts$3",
                    );
                  }
                }
              }
            }
          }
        }

        return details;
      }

      function getSemanticDiagnostics(filename: string) {
        const diagnostics = tsLs.getSemanticDiagnostics(filename);

        if (!config.enable) {
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
          // !! 2691,
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

        return diagnostics.filter((v: ts_module.Diagnostic) =>
          !ignoredDiagnostics.includes(v.code)
        );
      }

      const proxy: ts_module.LanguageService = Object.assign(
        Object.create(null),
        tsLs,
        {
          getCompletionEntryDetails,
          getSemanticDiagnostics,
        },
      );

      return proxy;
    },

    onConfigurationChanged(c: DenoPluginConfig) {
      logger.info("config change to:\n" + JSON.stringify(c, null, "  "));
      Object.assign(config, c);
      pluginInfo.project.markAsDirty();
      pluginInfo.project.refreshDiagnostics();
      pluginInfo.project.updateGraph();
    },
  };
};

function parseImportMapFromFile(cwd: string, file: string): ImportMaps | null {
  if (!path.isAbsolute(file)) {
    file = path.resolve(cwd, file);
  }

  const fullFilePath = normalizeFilepath(file);

  if (!pathExistsSync(fullFilePath)) {
    return null;
  }

  const content = readFileSync(fullFilePath, {
    encoding: "utf8",
  });

  try {
    return parseFromString(content, `file://${cwd}/`);
  } catch {
    return null;
  }
}

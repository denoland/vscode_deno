// modified from https://github.com/Microsoft/typescript-tslint-plugin
import * as fs from "fs";
import * as path from "path";

import merge from "merge-deep";
import mockRequire from "mock-require";
import ts_module from "typescript/lib/tsserverlibrary";

import { Logger } from "./logger";
import { getDenoDir, getGlobalDtsPath, getLocalDtsPath, getDtsPathForVscode } from "./utils";

let logger: Logger;

module.exports = function init({ typescript }: { typescript: typeof ts_module }) {
  // Make sure Deno imports the correct version of TS
  mockRequire("typescript", typescript);

  // see https://github.com/denoland/deno/blob/2debbdacb935cfe1eb7bb8d1f40a5063b339d90b/js/compiler.ts#L159-L170
  const OPTIONS: ts_module.CompilerOptions = {
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

  const OPTIONS_OVERWRITE_BY_DENO: ts_module.CompilerOptions = {
    allowNonTsExtensions: false,
    jsx: OPTIONS.jsx,
    module: OPTIONS.module,
    moduleResolution: OPTIONS.moduleResolution,
    resolveJsonModule: OPTIONS.resolveJsonModule,
    strict: OPTIONS.strict,
    noEmit: OPTIONS.noEmit,
    noEmitHelpers: OPTIONS.noEmitHelpers,
    target: typescript.ScriptTarget.ESNext,
    paths: {
      "abc": ['./c.ts'],
      "abc.ts": ['./c.ts'],
    },
  };

  return {
    create(info: ts_module.server.PluginCreateInfo): ts_module.LanguageService {
      logger = Logger.forPlugin(info);
      logger.info("Create.");

      // ref https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API#customizing-module-resolution
      const resolveModuleNames = info.languageServiceHost.resolveModuleNames;

      if (resolveModuleNames === undefined) {
        logger.info("resolveModuleNames is undefined.");
        return info.languageService;
      }

      info.languageServiceHost.resolveModuleNames = (
        moduleNames: string[],
        containingFile: string,
        reusedNames?: string[],
        redirectedReference?: ts_module.ResolvedProjectReference,
        options: ts_module.CompilerOptions = OPTIONS,
      ) => {
        moduleNames = moduleNames
          .map(convertRemoteToLocalCache)
          .map(stripExtNameDotTs);

        return resolveModuleNames.call(
          info.languageServiceHost,
          moduleNames,
          containingFile,
          reusedNames,
          redirectedReference,
          options,
        );
      };

      const getCompilationSettings = info.languageServiceHost.getCompilationSettings;

      info.languageServiceHost.getCompilationSettings = () => {
        const projectConfig = getCompilationSettings.call(info.languageServiceHost);
        const compilationSettings = merge(merge(OPTIONS, projectConfig), OPTIONS_OVERWRITE_BY_DENO);
        compilationSettings.baseUrl = info.project.getCurrentDirectory();
        logger.info(`compilationSettings:${JSON.stringify(compilationSettings)}`);
        return compilationSettings;
      };

      const getScriptFileNames = info.languageServiceHost.getScriptFileNames!;
      info.languageServiceHost.getScriptFileNames = () => {
        const scriptFileNames = getScriptFileNames.call(info.languageServiceHost);

        const denoDtsPath =
          getDtsPathForVscode(info) || getGlobalDtsPath() || getLocalDtsPath(info);

        if (denoDtsPath) {
          scriptFileNames.push(denoDtsPath);
        }

        logger.info(`dts path: ${denoDtsPath}`);

        return scriptFileNames;
      };

      const getCompletionEntryDetails = info.languageService.getCompletionEntryDetails;
      info.languageService.getCompletionEntryDetails = (
        fileName: string,
        position: number,
        name: string,
        formatOptions?: ts_module.FormatCodeOptions | ts_module.FormatCodeSettings,
        source?: string,
        preferences?: ts_module.UserPreferences,
      ) => {
        const details = getCompletionEntryDetails.call(
          info.languageService,
          fileName,
          position,
          name,
          formatOptions,
          source,
          preferences,
        );

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
      };

      // const getSemanticDiagnostics = info.languageService.getSemanticDiagnostics;

      // info.languageService.getSemanticDiagnostics = (filename: string) => {
      //   const diagnostics = getSemanticDiagnostics(filename);

      //   // ref: https://github.com/denoland/deno/blob/da8cb408c878aa6e90542e26173f1f14b5254d29/cli/js/compiler/util.ts#L262
      //   const ignoredDiagnostics = [
      //     // TS2306: File 'file:///Users/rld/src/deno/cli/tests/subdir/amd_like.js' is
      //     // not a module.
      //     2306,
      //     // TS1375: 'await' expressions are only allowed at the top level of a file
      //     // when that file is a module, but this file has no imports or exports.
      //     // Consider adding an empty 'export {}' to make this file a module.
      //     1375,
      //     // TS1103: 'for-await-of' statement is only allowed within an async function
      //     // or async generator.
      //     1103,
      //     // TS2691: An import path cannot end with a '.ts' extension. Consider
      //     // importing 'bad-module' instead.
      //     2691,
      //     // TS5009: Cannot find the common subdirectory path for the input files.
      //     5009,
      //     // TS5055: Cannot write file
      //     // 'http://localhost:4545/cli/tests/subdir/mt_application_x_javascript.j4.js'
      //     // because it would overwrite input file.
      //     5055,
      //     // TypeScript is overly opinionated that only CommonJS modules kinds can
      //     // support JSON imports.  Allegedly this was fixed in
      //     // Microsoft/TypeScript#26825 but that doesn't seem to be working here,
      //     // so we will ignore complaints about this compiler setting.
      //     5070,
      //     // TS7016: Could not find a declaration file for module '...'. '...'
      //     // implicitly has an 'any' type.  This is due to `allowJs` being off by
      //     // default but importing of a JavaScript module.
      //     7016,
      //   ];

      //   return diagnostics.filter((v: ts_module.Diagnostic) => !ignoredDiagnostics.includes(v.code));
      // };

      return info.languageService;
    },

    onConfigurationChanged(config: any) {
      logger.info(`onConfigurationChanged: ${JSON.stringify(config)}`);
    },
  };
};

function getModuleWithQueryString(moduleName: string): string | undefined {
  let name = moduleName;
  for (const index = name.indexOf("?"); index !== -1; name = name.substring(index + 1)) {
    const sub = name.substring(0, index);
    if (sub.endsWith(".ts") || sub.endsWith(".tsx")) {
      const cutLength = moduleName.length - name.length;
      return moduleName.substring(0, index + cutLength) || undefined;
    }
  }
  return undefined;
}

function stripExtNameDotTs(moduleName: string): string {
  const moduleWithQuery = getModuleWithQueryString(moduleName);
  if (moduleWithQuery) {
    return moduleWithQuery;
  }
  const next = moduleName.replace(/\.tsx?$/, "");
  if (next !== moduleName) {
    logger.info(`strip "${moduleName}" to "${next}".`);
  }
  return next;
}

function convertRemoteToLocalCache(moduleName: string): string {
  if (!moduleName.startsWith("http://") && !moduleName.startsWith("https://")) {
    return moduleName;
  }

  const denoDir = getDenoDir();
  // "https://deno.land/x/std/log/mod" to "$DENO_DIR/deps/https/deno.land/x/std/log/mod" (no ".ts" because stripped)
  const name = path.resolve(denoDir, "deps", moduleName.replace("://", "/"));
  const redirectedName = fallbackHeader(name);
  logger.info(`convert "${moduleName}" to "${redirectedName}".`);

  return redirectedName;
}

interface IDenoModuleHeaders {
  mime_type: string;
  redirect_to: string;
}

/**
 * If moduleName is not found, recursively search for headers and "redirect_to" property.
 */
function fallbackHeader(modulePath: string): string {
  if (fs.existsSync(modulePath)) {
    return modulePath;
  }

  const headersPath = `${modulePath}.headers.json`;
  if (fs.existsSync(headersPath)) {
    const headers: IDenoModuleHeaders = JSON.parse(
      fs.readFileSync(headersPath, { encoding: "utf-8" }),
    );
    logger.info(`redirect '${modulePath}' to '${headers.redirect_to}'.`);
    // TODO: avoid Circular
    return convertRemoteToLocalCache(headers.redirect_to);
  }
  return modulePath;
}

// modified from https://github.com/Microsoft/typescript-tslint-plugin
import * as fs from "fs";
import * as path from "path";

import merge from "merge-deep";
import mockRequire from "mock-require";
import ts_module from "typescript/lib/tsserverlibrary";

import { Logger } from "./logger";
import { getDenoDir } from "./shared";

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
    noEmit: true,
    outDir: "$deno$",
    removeComments: true,
    resolveJsonModule: true,
    sourceMap: true,
    target: typescript.ScriptTarget.ESNext,
    typeRoots: [],
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
      ) => {
        moduleNames = moduleNames.map(stripExtNameDotTs).map(convertRemoteToLocalCache);

        return resolveModuleNames.call(
          info.languageServiceHost,
          moduleNames,
          containingFile,
          reusedNames,
          redirectedReference,
        );
      };

      const getCompilationSettings = info.languageServiceHost.getCompilationSettings;

      info.languageServiceHost.getCompilationSettings = () => {
        const projectConfig = getCompilationSettings.call(info.languageServiceHost);
        const compilationSettings = merge(OPTIONS, projectConfig);
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
    if (name.substring(0, index).endsWith(".ts")) {
      const cutLength = moduleName.length - name.length;
      return moduleName.substring(0, index + cutLength);
    }
  }
}

function stripExtNameDotTs(moduleName: string): string {
  const moduleWithQuery = getModuleWithQueryString(moduleName);
  if (moduleWithQuery) {
    return moduleWithQuery;
  }

  if (!moduleName.endsWith(".ts")) {
    return moduleName;
  }

  const name = moduleName.slice(0, -3);
  logger.info(`strip "${moduleName}" to "${name}".`);

  return name;
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
  const validPath = modulePath.endsWith(".ts") ? modulePath : `${modulePath}.ts`;
  if (fs.existsSync(validPath)) {
    return modulePath;
  }

  const headersPath = `${validPath}.headers.json`;
  if (fs.existsSync(headersPath)) {
    const headers: IDenoModuleHeaders = JSON.parse(
      fs.readFileSync(headersPath, { encoding: "utf-8" }),
    );
    logger.info(`redirect "${modulePath}" to "${headers.redirect_to}".`);
    // TODO: avoid Circular
    return convertRemoteToLocalCache(stripExtNameDotTs(headers.redirect_to));
  }
  return modulePath;
}

function getDtsPathForVscode(info: ts_module.server.PluginCreateInfo): string | undefined {
  const bundledDtsPath = info.config.dtsPath;

  if (bundledDtsPath && fs.existsSync(bundledDtsPath)) {
    return bundledDtsPath;
  }

  return undefined;
}

function getGlobalDtsPath(): string | undefined {
  const denoDir = getDenoDir();
  const globalDtsPath = path.resolve(denoDir, "lib.deno_runtime.d.ts");

  if (fs.existsSync(globalDtsPath)) {
    return globalDtsPath;
  }

  return undefined;
}

function getLocalDtsPath(info: ts.server.PluginCreateInfo): string | undefined {
  const localDtsPath = path.resolve(
    info.project.getCurrentDirectory(),
    "node_modules",
    "typescript-deno-plugin",
    "lib",
    "lib.deno_runtime.d.ts",
  );

  if (fs.existsSync(localDtsPath)) {
    return localDtsPath;
  }

  return undefined;
}

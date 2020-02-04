// modified from https://github.com/Microsoft/typescript-tslint-plugin
import * as fs from "fs";
import * as path from "path";

import merge from "deepmerge";
import ts_module from "typescript/lib/tsserverlibrary";

import { Logger } from "./logger";
import { getDenoDir } from "./shared";

const TYPESCRIPT_EXT_REG = /\.tsx?$/;

let logger: Logger;

function existsSync(filepath: string) {
  try {
    return fs.existsSync(filepath);
  } catch (err) {
    return false;
  }
}

interface IConfig {
  enable: boolean;
  dtsFilepaths?: string[];
}

let config: IConfig = {
  dtsFilepaths: [],
  enable: true
};

module.exports = function init({
  typescript
}: {
  typescript: typeof ts_module;
}) {
  // see https://github.com/denoland/deno/blob/2debbdacb935cfe1eb7bb8d1f40a5063b339d90b/js/compiler.ts#L159-L170
  const OPTIONS: ts_module.CompilerOptions = {
    allowJs: true,
    checkJs: true,
    esModuleInterop: true,
    jsx: typescript.JsxEmit.React,
    module: typescript.ModuleKind.ESNext,
    moduleResolution: typescript.ModuleResolutionKind.NodeJs,
    noEmit: true,
    noEmitHelpers: true,
    resolveJsonModule: true,
    sourceMap: true
  };

  // No matter how tsconfig.json is set in the working directory
  // It will always overwrite the configuration
  const mustOverwriteOptions: ts_module.CompilerOptions = {
    jsx: OPTIONS.jsx,
    module: OPTIONS.module,
    moduleResolution: OPTIONS.moduleResolution,
    resolveJsonModule: OPTIONS.resolveJsonModule,
    strict: OPTIONS.strict,
    noEmit: OPTIONS.noEmit,
    noEmitHelpers: OPTIONS.noEmitHelpers
  };

  return {
    create(info:
      ts_module.server.PluginCreateInfo): ts_module.LanguageService
    {
      logger = Logger.forPlugin(info);

      logger.info(`Create typescript-deno-plugin`);
      const getCompilationSettings = info.languageServiceHost
        .getCompilationSettings.bind(
          info.languageServiceHost
        );
      const getScriptFileNames = info.languageServiceHost.getScriptFileNames
        .bind(
          info.languageServiceHost
        );
      // ref https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API#customizing-module-resolution
      const resolveModuleNames = info.languageServiceHost.resolveModuleNames
        ?.bind(
          info.languageServiceHost
        );
      const getCompletionEntryDetails = info.languageService
        .getCompletionEntryDetails.bind(
          info.languageService
        );
      const getCompletionsAtPosition = info.languageService
        .getCompletionsAtPosition.bind(
          info.languageService
        );
      const getSemanticDiagnostics = info.languageService
        .getSemanticDiagnostics.bind(
          info.languageService
        );

      info.languageServiceHost.getCompilationSettings = () => {
        const projectConfig = getCompilationSettings();

        if (!config.enable) {
          return projectConfig;
        }

        const compilationSettings = merge(
          merge(OPTIONS, projectConfig),
          mustOverwriteOptions
        );

        logger.info(
          `compilationSettings:${JSON.stringify(compilationSettings)}`
        );
        return compilationSettings;
      };

      info.languageServiceHost.getScriptFileNames = () => {
        const scriptFileNames = getScriptFileNames();

        if (!config.enable) {
          return scriptFileNames;
        }

        let dtsFilepaths = getDtsPathForVscode(info);

        if (!dtsFilepaths.length) {
          dtsFilepaths = getGlobalDtsPath();
        }

        for (const filepath of dtsFilepaths) {
          scriptFileNames.push(filepath);
          logger.info(`load dts filepath: ${filepath}`);
        }

        return scriptFileNames;
      };

      info.languageService.getCompletionsAtPosition = (
        filename,
        position,
        options
      ) => {
        const prior = getCompletionsAtPosition(filename, position, options);

        if (!config.enable) {
          return prior;
        }

        logger.info(`completeions ${JSON.stringify(prior)}`);

        return prior;
      };

      info.languageService.getCompletionEntryDetails = (
        fileName: string,
        position: number,
        name: string,
        formatOptions?: ts_module.FormatCodeOptions
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

        if (!config.enable) {
          return details;
        }

        if (details) {
          if (details.codeActions?.length) {
            for (const ca of details.codeActions) {
              for (const change of ca.changes) {
                if (!change.isNewFile) {
                  for (const tc of change.textChanges) {
                    tc.newText = tc.newText.replace(
                      /^(import .* from ['"])(\..*)(['"];\n)/i,
                      "$1$2.ts$3"
                    );
                  }
                }
              }
            }
          }
        }

        return details;
      };

      info.languageService.getSemanticDiagnostics = (filename: string) => {
        const diagnostics = getSemanticDiagnostics(filename);

        if (!config.enable) {
          return diagnostics;
        }

        const ignoreCodeMapInDeno: { [k: number]: boolean; } = {
          2691: true, // can not import module which end with `.ts`
          1308: true // support top level await 只允许在异步函数中使用 "await" 表达式
        };

        return diagnostics.filter(v => {
          return !ignoreCodeMapInDeno[v.code];
        });
      };

      if (!resolveModuleNames) {
        logger.info("resolveModuleNames is undefined.");
        return info.languageService;
      }

      info.languageServiceHost.resolveModuleNames = (
        moduleNames: string[],
        containingFile: string,
        reusedNames?: string[],
        redirectedReference?: ts_module.ResolvedProjectReference
      ) => {
        if (!config.enable) {
          return resolveModuleNames(
            moduleNames,
            containingFile,
            reusedNames,
            redirectedReference,
            {}
          );
        }

        moduleNames = moduleNames
          .map(stripExtNameDotTs)
          .map(convertRemoteToLocalCache);

        return resolveModuleNames(
          moduleNames,
          containingFile,
          reusedNames,
          redirectedReference,
          {}
        );
      };

      return info.languageService;
    },

    onConfigurationChanged(c: IConfig) {
      config = merge(config, c);
      config.dtsFilepaths = c.dtsFilepaths;
      logger.info(`onConfigurationChanged: ${JSON.stringify(c)}`);
    }
  };
};

function getModuleWithQueryString(moduleName: string): string | undefined {
  let name = moduleName;
  for (
    const index = name.indexOf("?"); index !== -1; name = name
      .substring(index + 1)
  ) {
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

  if (TYPESCRIPT_EXT_REG.test(moduleName) === false) {
    return moduleName;
  }

  const name = moduleName.replace(TYPESCRIPT_EXT_REG, "");
  logger.info(`strip "${moduleName}" to "${name}".`);

  return name;
}

function convertRemoteToLocalCache(moduleName: string): string {
  if (!/^https?:\/\//.test(moduleName)) {
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
  const validPath = TYPESCRIPT_EXT_REG.test(modulePath)
    ? modulePath
    : `${modulePath}.ts`;

  if (existsSync(validPath)) {
    return modulePath;
  }

  const headersPath = `${validPath}.headers.json`;
  if (existsSync(headersPath)) {
    const headers: IDenoModuleHeaders = JSON.parse(
      fs.readFileSync(headersPath, { encoding: "utf-8" })
    );
    logger.info(`redirect "${modulePath}" to "${headers.redirect_to}".`);
    // TODO: avoid Circular
    return convertRemoteToLocalCache(stripExtNameDotTs(headers.redirect_to));
  }
  return modulePath;
}

function getDtsPathForVscode(info: ts.server.PluginCreateInfo): string[] {
  const dtsFilepaths = config.dtsFilepaths || [];

  const projectDir = info.project.getCurrentDirectory();

  return dtsFilepaths
    .map(filepath => {
      const absFilepath = path.isAbsolute(filepath)
        ? filepath
        : path.resolve(projectDir, filepath);

      if (existsSync(absFilepath)) {
        return absFilepath;
      }
      return "";
    })
    .filter(v => v.endsWith(".d.ts"));
}

function getGlobalDtsPath(): string[] {
  const denoDir = getDenoDir();
  const globalDtsPath = path.resolve(denoDir, "lib.deno_runtime.d.ts");

  if (existsSync(globalDtsPath)) {
    return [globalDtsPath];
  }

  return [];
}

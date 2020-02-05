// modified from https://github.com/Microsoft/typescript-tslint-plugin
import * as fs from "fs";
import * as path from "path";

import merge from "deepmerge";
import ts_module from "typescript/lib/tsserverlibrary";

import { Logger } from "./logger";
import { getDenoDir } from "./shared";

const TYPESCRIPT_EXT_REG = /\.(t|j)sx?$/;

let logger: Logger;

function existsSync(filepath: string) {
  try {
    return fs.existsSync(filepath);
  } catch (err) {
    return false;
  }
}

interface IImportMap {
  imports: { [key: string]: string };
}

interface IConfig {
  enable: boolean;
  dtsFilepaths?: string[];
  import_map?: string;
  workspaceDir?: string;
}

let config: IConfig = {
  dtsFilepaths: [],
  enable: true,
  import_map: "",
  workspaceDir: ""
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
    create(info: ts_module.server.PluginCreateInfo): ts_module.LanguageService {
      logger = Logger.forPlugin(info);

      logger.info(`Create typescript-deno-plugin`);
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

      info.languageService.getSemanticDiagnostics = (filename: string) => {
        const diagnostics = getSemanticDiagnostics(filename);

        if (!config.enable) {
          return diagnostics;
        }

        const ignoreCodeMapInDeno: { [k: number]: boolean } = {
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

        let importMaps: IImportMap;

        //  try resolve import maps
        if (config.import_map) {
          const importMapsFilepath = path.isAbsolute(config.import_map)
            ? config.import_map
            : path.resolve(
                config.workspaceDir || process.cwd(),
                config.import_map
              );

          if (typescript.sys.fileExists(importMapsFilepath)) {
            const importMapContent = typescript.sys.readFile(
              importMapsFilepath
            );

            try {
              importMaps = JSON.parse(importMapContent || "{}");
            } catch {}
          }
        }

        moduleNames = moduleNames
          .map(name => resolveImportMap(importMaps, name))
          .map(convertRemoteToLocalCache)
          .map(stripExtNameDotTs);

        logger.info(`resolve module ${JSON.stringify(moduleNames)}`);

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
      logger.info(`onConfigurationChanged: ${JSON.stringify(c)}`);
      config = merge(config, c);
      config.dtsFilepaths = c.dtsFilepaths;
    }
  };
};

function getModuleWithQueryString(moduleName: string): string | undefined {
  let name = moduleName;
  for (
    const index = name.indexOf("?");
    index !== -1;
    name = name.substring(index + 1)
  ) {
    if (name.substring(0, index).endsWith(".ts")) {
      const cutLength = moduleName.length - name.length;
      return moduleName.substring(0, index + cutLength);
    }
  }
}

function resolveImportMap(importMaps: IImportMap, moduleName: string): string {
  if (!importMaps) {
    return moduleName;
  }
  const maps = importMaps.imports || {};

  for (const prefix in maps) {
    const mapModule = maps[prefix];

    const reg = new RegExp("^" + prefix);
    if (reg.test(moduleName)) {
      moduleName = moduleName.replace(reg, mapModule);
    }
  }

  return moduleName;
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
  let filepath = path.resolve(denoDir, "deps", moduleName.replace("://", "/"));

  if (!existsSync(filepath)) {
    const headersPath = `${filepath}.headers.json`;
    if (existsSync(headersPath)) {
      const headers: IDenoModuleHeaders = JSON.parse(
        fs.readFileSync(headersPath, { encoding: "utf-8" })
      );
      if (moduleName !== headers.redirect_to) {
        const redirectFilepath = convertRemoteToLocalCache(headers.redirect_to);
        logger.info(`redirect "${filepath}" to "${redirectFilepath}".`);
        filepath = redirectFilepath;
      }
    }
  }

  logger.info(`convert "${moduleName}" to "${filepath}".`);

  return filepath;
}

interface IDenoModuleHeaders {
  mime_type: string;
  redirect_to: string;
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

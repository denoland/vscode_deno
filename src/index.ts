// modified from https://github.com/Microsoft/typescript-tslint-plugin
import * as fs from "fs";
import * as path from "path";

import * as mockRequire from "mock-require";
import * as ts_module from "typescript/lib/tsserverlibrary";

import { Logger } from "./logger";
import { getDenoDir } from "./shared";

let logger: Logger;

// see https://github.com/denoland/deno/blob/2debbdacb935cfe1eb7bb8d1f40a5063b339d90b/js/compiler.ts#L159-L170
const OPTIONS: ts_module.CompilerOptions = {
  allowJs: true,
  checkJs: true,
  esModuleInterop: true,
  module: ts_module.ModuleKind.ESNext,
  moduleResolution: ts_module.ModuleResolutionKind.NodeJs,
  noEmit: true,
  outDir: "$deno$",
  removeComments: true,
  resolveJsonModule: true,
  sourceMap: true,
  target: ts_module.ScriptTarget.ESNext,
  typeRoots: []
};

export = function init({ typescript }: { typescript: typeof ts_module }) {
  // Make sure Deno imports the correct version of TS
  mockRequire("typescript", typescript);

  return {
    create(info: ts.server.PluginCreateInfo): ts_module.LanguageService {
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
        redirectedReference?: ts_module.ResolvedProjectReference
      ) => {
        moduleNames = moduleNames
          .map(stripExtNameDotTs)
          .map(convertRemoteToLocalCache);

        return resolveModuleNames.call(
          info.languageServiceHost,
          moduleNames,
          containingFile,
          reusedNames,
          redirectedReference
        );
      };

      const projectSetting = info.project.getCompilationSettings();
      info.languageServiceHost.getCompilationSettings = () => {
        return { ...OPTIONS, ...projectSetting };
      };

      return info.languageService;
    }
  };
};

function stripExtNameDotTs(moduleName: string): string {
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
  const name = path.join(denoDir, "deps", moduleName.replace("://", "/"));
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
    const headers: IDenoModuleHeaders = JSON.parse(fs.readFileSync(headersPath, { encoding: "utf-8" }));
    logger.info(`redirect "${modulePath}" to "${headers.redirect_to}".`);
    // TODO: avoid Circular
    return convertRemoteToLocalCache(stripExtNameDotTs(headers.redirect_to));
  }
  return modulePath;
}

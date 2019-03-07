// modified from https://github.com/Microsoft/typescript-tslint-plugin
import * as path from "path";

import * as mockRequire from "mock-require";
import * as ts_module from "typescript/lib/tsserverlibrary";

import { Logger } from "./logger";

let logger: Logger;

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

  // ref https://deno.land/manual.html
  // On Linux/Redox: $XDG_CACHE_HOME/deno or $HOME/.cache/deno
  // On Windows: %LOCALAPPDATA%/deno (%LOCALAPPDATA% = FOLDERID_LocalAppData)
  // On macOS: $HOME/Library/Caches/deno
  // If something fails, it falls back to $HOME/.deno
  let denoDir = process.env.DENO_DIR;
  if (denoDir === undefined) {
    switch (process.platform) {
      case "win32":
        denoDir = `${process.env.LOCALAPPDATA}\\deno`;
        break;
      case "darwin":
        denoDir = `${process.env.HOME}/Library/Caches/deno`;
        break;
      case "linux":
        denoDir = `${process.env.HOME}/.cache/deno`;
        break;
      default:
        denoDir = `${process.env.HOME}/.deno`;
    }
  }

  // "https://deno.land/x/std/log/mod.ts" to "$DENO_DIR/deps/https/deno.land/x/std/log/mod.ts"
  const name = path.join(denoDir, "deps", moduleName.replace("://", "/"));
  logger.info(`convert "${moduleName}" to "${name}".`);

  return name;
}

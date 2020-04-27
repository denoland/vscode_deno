import * as fs from "fs";
import * as path from "path";

import ts_module from "typescript/lib/tsserverlibrary";

export function getDenoDir(): string {
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

  return denoDir;
}


export function getGlobalDtsPath(): string | undefined {
  const denoDir = getDenoDir();
  const globalDtsPath = path.resolve(denoDir, "lib.deno_runtime.d.ts");

  if (fs.existsSync(globalDtsPath)) {
    return globalDtsPath;
  }

  return undefined;
}

export function getLocalDtsPath(info: ts.server.PluginCreateInfo): string | undefined {
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

export
function getDtsPathForVscode(info: ts_module.server.PluginCreateInfo): string | undefined {
  const bundledDtsPath = info.config.dtsPath;

  if (bundledDtsPath && fs.existsSync(bundledDtsPath)) {
    return bundledDtsPath;
  }

  return undefined;
}

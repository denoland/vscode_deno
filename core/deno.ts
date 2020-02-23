import * as path from "path";

import { str2regexpStr } from "./util";

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
        denoDir = process.env.XDG_CACHE_HOME
          ? `${process.env.XDG_CACHE_HOME}/deno`
          : `${process.env.HOME}/.cache/deno`;
        break;
      default:
        denoDir = `${process.env.HOME}/.deno`;
    }
  }

  return denoDir;
}

export function getDenoDepsDir(): string {
  return path.join(getDenoDir(), "deps");
}

// cover filepath to url
// eg.
// C:\Users\runneradmin\AppData\Local\deno\deps\https\deno.land\std\http\server.ts
// https://deno.land/std/http/server.ts
export function demoModuleFilepathToUrl(denoModuleFilepath: string): string {
  return denoModuleFilepath
    .replace(new RegExp("^" + str2regexpStr(getDenoDepsDir() + path.sep)), "")
    .replace(new RegExp("^(https?)" + str2regexpStr(path.sep)), "$1://")
    .replace(new RegExp(str2regexpStr(path.sep), "gm"), "/");
}

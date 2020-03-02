import * as path from "path";

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

export function getDenoDts(): string {
  return path.join(getDenoDir(), "lib.deno_runtime.d.ts");
}

export function isInDeno(filepath: string): boolean {
  const denoDir = getDenoDir();
  // in Windows, filepath maybe `c:\xxx\xxx`
  // but deno dir prefix with `C:\xxx\xxx`
  return filepath
    .replace(/^([a-z]):\\/, ($0, $1) => $1.toUpperCase() + ":\\")
    .startsWith(denoDir);
}

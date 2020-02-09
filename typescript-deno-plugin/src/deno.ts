import * as path from "path";

export class Deno {
  static get DENO_DEPS(): string {
    return path.join(Deno.DENO_DIR, "deps");
  }
  static get DENO_DIR(): string {
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
  static get declarationFile(): string[] {
    return ["lib.deno_runtime.d.ts"].map(v => path.join(Deno.DENO_DIR, v));
  }
}

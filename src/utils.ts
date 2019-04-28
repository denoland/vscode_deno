import * as fs from "fs";
import * as path from "path";
import * as execa from "execa";

import { TextDocument, workspace } from "vscode";

export interface DenoVersion {
  deno: string;
  v8: string;
  typescript: string;
  raw: string;
}

export function packageExists() {
  if (!workspace.rootPath) {
    return false;
  }

  try {
    const filename = path.join(workspace.rootPath, "package.json");
    const stat = fs.statSync(filename);
    return stat && stat.isFile();
  } catch (ignored) {
    return false;
  }
}

export function tsconfigExists() {
  if (!workspace.rootPath) {
    return false;
  }

  try {
    const filename = path.join(workspace.rootPath, "tsconfig.json");
    const stat = fs.statSync(filename);
    return stat && stat.isFile();
  } catch (ignored) {
    return false;
  }
}

export function isTypeScriptDocument(document: TextDocument) {
  return (
    document.languageId === "typescript" ||
    document.languageId === "typescriptreact"
  );
}

export function isJavaScriptDocument(document: TextDocument) {
  return (
    document.languageId === "javascript" ||
    document.languageId === "javascriptreact"
  );
}

export async function getVersions(): Promise<DenoVersion | undefined> {
  try {
    const { stdout, stderr } = await execa("deno", ["version"]);

    if (stderr) {
      return;
    }

    const [deno, v8, typescript] = stdout.split("\n");

    return {
      deno: deno.substr(6),
      v8: v8.substr(4),
      typescript: typescript.substr(12),
      raw: stdout
    };
  } catch {
    return;
  }
}

// TODO: duplicate
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

// Generate Deno's .d.ts file
export async function generateDtsForDeno(): Promise<void> {
  try {
    const denoDir: string = getDenoDir();
    if (!fs.existsSync(denoDir)) {
      fs.mkdirSync(denoDir, { recursive: true });
    }

    const { stdout, stderr } = await execa("deno", ["types"]);

    if (stderr) {
      return;
    }

    fs.writeFileSync(path.resolve(denoDir, "lib.deno_runtime.d.ts"), stdout);
  } catch {
    return;
  }
}

// TODO: download Deno's .d.ts file
export function downloadDtsForDeno(): void {}

import * as fs from "fs";
import * as path from "path";
import execa from "execa";

import * as vscode from "vscode";
import * as lsp from "vscode-languageclient";

export interface DenoVersion {
  deno: string;
  v8: string;
  typescript: string;
  raw: string;
}

export function packageExists() {
  if (!vscode.workspace.rootPath) {
    return false;
  }

  try {
    const filename = path.join(vscode.workspace.rootPath, "package.json");
    const stat = fs.statSync(filename);
    return stat && stat.isFile();
  } catch (ignored) {
    return false;
  }
}

export function tsconfigExists() {
  if (!vscode.workspace.rootPath) {
    return false;
  }

  try {
    const filename = path.join(vscode.workspace.rootPath, "tsconfig.json");
    const stat = fs.statSync(filename);
    return stat && stat.isFile();
  } catch (ignored) {
    return false;
  }
}

export function isTypeScriptDocument(document: vscode.TextDocument) {
  return (
    document.languageId === "typescript" ||
    document.languageId === "typescriptreact"
  );
}

export function isJavaScriptDocument(document: vscode.TextDocument) {
  return (
    document.languageId === "javascript" ||
    document.languageId === "javascriptreact"
  );
}

export async function getVersions(): Promise<DenoVersion | undefined> {
  try {
    const { stdout, stderr } = await execa("deno", [
      "eval",
      "console.log(JSON.stringify(Deno.version))",
    ]);

    if (stderr) {
      return;
    }

    const { deno, v8, typescript } = JSON.parse(stdout);

    return {
      deno,
      v8,
      typescript,
      raw: `deno: ${deno}\nv8: ${v8}\ntypescript: ${typescript}`,
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

    fs.writeFileSync(path.resolve(denoDir, "lib.deno.d.ts"), stdout);
  } catch {
    return;
  }
}

export async function getTypeScriptLanguageExtension() {
  const typeScriptExtensionId = "vscode.typescript-language-features";

  const extension = vscode.extensions.getExtension(typeScriptExtensionId);
  if (!extension) {
    return;
  }

  await extension.activate();
  if (!extension.exports || !extension.exports.getAPI) {
    return;
  }

  const api = extension.exports.getAPI(0);
  if (!api) {
    return;
  }

  return api;
}

/**
 * Construct the arguments that's used to spawn the server process.
 * @param ctx vscode extension context
 * @param debug true if debug mode is on
 */
function constructArgs(ctx: vscode.ExtensionContext, debug: boolean): string[] {
  const config = vscode.workspace.getConfiguration();
  const args: string[] = [];

  const denoLog: string = config.get("deno.log", "off");
  if (denoLog !== "off") {
    // Log file does not yet exist on disk. It is up to the server to create the file.
    const logFile = path.join(ctx.logPath, "denoserver.log");
    args.push("--logFile", logFile);
    args.push("--logVerbosity", debug ? "verbose" : denoLog);
  }

  // Load tsconfig.json configuration file
  const tsconfig: string | null = config.get("deno.tsconfig", null);
  if (tsconfig) {
    args.push("--config", ctx.asAbsolutePath(tsconfig));
  }

  // Load import map file
  const importmap: string | null = config.get("deno.importmap", null);
  if (importmap) {
    args.push("--importmap", ctx.asAbsolutePath(importmap));
  }

  // TODO: try to load a ts consistent with the built-in version of Deno.
  // use use the specified `bundled` as fallback if none is provided
  // const tsdk: string|null = config.get('typescript.tsdk', null);
  args.push("--tsdk", ctx.extensionPath);
  return args;
}

export function getServerOptions(
  ctx: vscode.ExtensionContext,
  debug: boolean,
): lsp.NodeModule {
  // Environment variables for server process
  const prodEnv = {
    // Force TypeScript to use the non-polling version of the file watchers.
    TSC_NONPOLLING_WATCHER: true,
  };
  const devEnv = {
    ...prodEnv,
    DENO_DEBUG: true,
  };

  // Node module for the language server
  const prodBundle = ctx.asAbsolutePath("server");
  const devBundle = ctx.asAbsolutePath(path.join("server", "out", "server.js"));

  // Argv options for Node.js
  const prodExecArgv: string[] = [];
  const devExecArgv: string[] = [
    // do not lazily evaluate the code so all breakpoints are respected
    "--nolazy",
    // If debugging port is changed, update .vscode/launch.json as well
    "--inspect=6009",
  ];

  return {
    // VS Code Insider launches extensions in debug mode by default but users
    // install prod bundle so we have to check whether dev bundle exists.
    module: debug && fs.existsSync(devBundle) ? devBundle : prodBundle,
    transport: lsp.TransportKind.ipc,
    args: constructArgs(ctx, debug),
    options: {
      env: debug ? devEnv : prodEnv,
      execArgv: debug ? devExecArgv : prodExecArgv,
    },
  };
}

export async function delay(ms: number): Promise<void> {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

export async function restartTsServer(): Promise<void> {
  await delay(1000);
  vscode.commands.executeCommand("typescript.restartTsServer");
}

// TODO: download lib.deno.d.ts
export function downloadLibDenoDts(): void {}

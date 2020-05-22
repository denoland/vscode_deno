// Copyright 2019-2020 the Deno authors. All rights reserved. MIT license.

import * as path from "path";
import * as fs from "fs";
import execa from "execa";
import which from "which";
import { Readable } from "stream";

export interface DenoVersions {
  deno: string;
  v8: string;
  typescript: string;
  raw: string;
}

export interface IDeno {
  path: string;
  version: DenoVersions;
}

export interface IDenoErrorData {
  error?: Error;
  message?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  DenoErrorCode?: string;
  DenoCommand?: string;
}

export class DenoError {
  error?: Error;
  message: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  DenoErrorCode?: string;
  DenoCommand?: string;

  constructor(data: IDenoErrorData) {
    if (data.error) {
      this.error = data.error;
      this.message = data.error.message;
    } else {
      this.error = undefined;
      this.message = "";
    }

    this.message = this.message || data.message || "Deno error";
    this.stdout = data.stdout;
    this.stderr = data.stderr;
    this.exitCode = data.exitCode;
    this.DenoErrorCode = data.DenoErrorCode;
    this.DenoCommand = data.DenoCommand;
  }

  toString(): string {
    let result = this.message +
      " " +
      JSON.stringify(
        {
          exitCode: this.exitCode,
          DenoErrorCode: this.DenoErrorCode,
          DenoCommand: this.DenoCommand,
          stdout: this.stdout,
          stderr: this.stderr,
        },
        null,
        2,
      );

    if (this.error) {
      result += (<any> this.error).stack;
    }

    return result;
  }
}

class Deno {
  public versions: DenoVersions | undefined;
  public path: string | undefined;

  public async init() {
    this.path = await this.getExePath();

    if (!this.path) {
      throw new Error(
        "Could not find `deno` in your $PATH. Please install `deno`, then restart the extension.",
      );
    }

    this.versions = await this.getVersions();

    if (!this.versions) {
      return;
    }
  }

  public getDenoDir(): string {
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

  public isInDenoDir(filepath: string): boolean {
    filepath = this.normalizeFilepath(filepath);
    const denoDir = this.getDenoDir();
    return filepath.startsWith(denoDir);
  }

  public normalizeFilepath(filepath: string): string {
    return path.normalize(
      filepath
        // in Windows, filepath maybe `c:\foo\bar` tut the legal path should be `C:\foo\bar`
        .replace(/^([a-z]):\\/, (_, $1) => $1.toUpperCase() + ":\\")
        // There are some paths which are unix style, this style does not work on win32 systems
        .replace(/\//gm, path.sep),
    );
  }

  private bundledDtsPath(extensionPath: string): string {
    return path.resolve(
      extensionPath,
      "node_modules",
      "typescript-deno-plugin",
      "lib",
    );
  }

  // Generate Deno's .d.ts file
  public async generateDtsForDeno(
    extensionPath: string,
    unstable: boolean,
  ): Promise<void> {
    const denoDir: string = this.getDenoDir();

    const bundledPath = this.bundledDtsPath(extensionPath);

    if (!fs.existsSync(denoDir)) {
      fs.mkdirSync(denoDir, { recursive: true });
    }

    // copy bundled lib.webworker.d.ts to `denoDir`
    // fix https://github.com/microsoft/TypeScript/issues/5676
    fs.copyFileSync(
      path.resolve(bundledPath, "lib.webworker.d.ts"),
      path.resolve(denoDir, "lib.webworker.d.ts"),
    );

    try {
      const args = ["types"];
      if (unstable) args.push("--unstable");

      const { stdout, stderr } = await execa(this.path, args);
      if (stderr) {
        throw stderr;
      }

      fs.writeFileSync(path.resolve(denoDir, "lib.deno.d.ts"), stdout);
    } catch {
      // if `deno types` fails, just copy bundled lib.deno.d.ts to `denoDir`
      fs.copyFileSync(
        path.resolve(bundledPath, "lib.deno.d.ts"),
        path.resolve(denoDir, "lib.deno.d.ts"),
      );
    }
  }

  public format(code: string): Promise<string> {
    const reader = Readable.from([code]);

    const subprocess = execa(this.path, ["fmt", "-"], {
      stdout: "pipe",
      stderr: "pipe",
      stdin: "pipe",
    });

    return new Promise((resolve, reject) => {
      let stdout = "";
      let stderr = "";
      subprocess.on("exit", (exitCode: number) => {
        if (exitCode !== 0) {
          reject(new Error(stderr));
        } else {
          resolve(stdout);
        }
      });
      subprocess.on("error", (err: Error) => {
        reject(err);
      });
      subprocess.stdout.on("data", (data: Buffer) => {
        stdout += data;
      });

      subprocess.stderr.on("data", (data: Buffer) => {
        stderr += data;
      });

      subprocess.stdin && reader.pipe(subprocess.stdin);
    });
  }

  private async getExePath(): Promise<string | undefined> {
    const denoPath = await which("deno").catch(() =>
      Promise.resolve(undefined)
    );

    return denoPath;
  }

  private async getVersions(): Promise<DenoVersions | undefined> {
    try {
      const { stdout, stderr } = await execa(this.path, [
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
}

const deno = new Deno();

export { deno };

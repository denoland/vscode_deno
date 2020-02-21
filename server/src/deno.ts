import { Readable } from "stream";
import * as path from "path";
import { promises as fs } from "fs";

import * as ts from "typescript";
import execa from "execa";
import which from "which";
import { localize } from "vscode-nls-i18n";
import * as semver from "semver";

type Version = {
  deno: string;
  v8: string;
  typescript: string;
  raw: string;
};

export type DenoModule = {
  filepath: string;
  raw: string;
  remote: boolean;
};

export type ImportMap = {
  imports: { [key: string]: string };
};

type FormatOptions = {
  cwd: string;
};

export type Deps = {
  url: string;
  filepath: string;
};

type ModuleHeaders = {
  mime_type: string;
  redirect_to?: string;
  x_typescript_types?: string;
};

class Deno {
  public version!: Version | void;
  public executablePath!: string | void;
  public readonly DENO_DIR = this.getDenoDir();
  public readonly DENO_DEPS_DIR = path.join(this.DENO_DIR, "deps");
  public readonly DTS_FILE = path.join(this.DENO_DIR, "lib.deno_runtime.d.ts");
  public async init() {
    this.executablePath = await this.getExecutablePath();

    if (!this.executablePath) {
      throw new Error(localize("err.not_install_deno"));
    }

    this.version = await this.getDenoVersion();

    if (!this.version) {
      return;
    }

    // If the currently used Deno is less than 0.33.0
    // We will give an warning to upgrade.
    const minimumDenoVersion = "0.33.0";
    if (!semver.gte(this.version.deno, minimumDenoVersion)) {
      throw new Error(
        localize("err.below_deno_minimum_requirements", minimumDenoVersion)
      );
    }
  }
  public async getTypes(): Promise<Buffer> {
    const { stdout } = await execa(this.executablePath as string, ["types"]);

    return Buffer.from(stdout, "utf8");
  }
  // format code
  // echo "console.log(123)" | deno fmt --stdin
  public async format(code: string, options: FormatOptions): Promise<string> {
    const reader = Readable.from([code]);

    const subprocess = execa(this.executablePath as string, ["fmt", "-"], {
      cwd: options.cwd,
      stdout: "pipe",
      stderr: "pipe",
      stdin: "pipe"
    });

    const formattedCode = (await new Promise((resolve, reject) => {
      let stdout = "";
      let stderr = "";
      subprocess.on("exit", (exitCode: number) => {
        if (exitCode != 0) {
          reject(new Error(stderr));
        } else {
          resolve(stdout);
        }
      });
      subprocess.on("error", (err: Error) => {
        reject(err);
      });
      subprocess.stdout?.on("data", (data: Buffer) => {
        stdout += data;
      });

      subprocess.stderr?.on("data", (data: Buffer) => {
        stderr += data;
      });

      subprocess.stdin && reader.pipe(subprocess.stdin);
    })) as string;

    return formattedCode;
  }
  // public for test
  public _filepath2url(
    denoModuleFilepath: string,
    denoDepsDir = deno.DENO_DEPS_DIR
  ): string {
    return denoModuleFilepath
      .replace(new RegExp("^" + denoDepsDir + path.sep), "")
      .replace(new RegExp("^(https?)" + path.sep), "$1://")
      .replace(new RegExp(path.sep, "gm"), "/");
  }
  // get deno dependencies files
  public async getDependencies(
    rootDir = this.DENO_DEPS_DIR,
    deps: Deps[] = [],
    denoDepsDir: string = this.DENO_DEPS_DIR
  ) {
    const files = await fs.readdir(rootDir);

    const promises = files.map(filename => {
      const filepath = path.join(rootDir, filename);
      return fs.stat(filepath).then(stat => {
        const isInternalModule =
          filename.startsWith("_") || filename.startsWith(".");
        if (stat.isDirectory() && !isInternalModule) {
          return this.getDependencies(filepath, deps, denoDepsDir);
        } else if (
          stat.isFile() &&
          filepath.endsWith(".headers.json") &&
          !isInternalModule
        ) {
          const moduleFilepath = filepath.replace(/\.headers\.json$/, "");

          deps.push({
            url: this._filepath2url(moduleFilepath, denoDepsDir),
            filepath: moduleFilepath
          });
        }
      });
    });

    await Promise.all(promises);

    return deps;
  }
  public getImportMaps(
    importMapFilepath: string | undefined,
    workspaceDir: string
  ) {
    let importMaps: ImportMap = {
      imports: {}
    };

    //  try resolve import maps
    if (importMapFilepath) {
      const importMapsFilepath = path.isAbsolute(importMapFilepath)
        ? importMapFilepath
        : path.resolve(workspaceDir, importMapFilepath);

      if (ts.sys.fileExists(importMapsFilepath)) {
        const importMapContent = ts.sys.readFile(importMapsFilepath);

        try {
          importMaps = JSON.parse(importMapContent || "");
        } catch {
          importMaps.imports = {};
        }
      }
    }

    return importMaps;
  }
  public _resolveModuleFromImportMap(
    importMaps: ImportMap,
    moduleName: string
  ): string {
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
  public async resolveModule(
    importMaps: ImportMap,
    importerFolder: string,
    moduleName: string,
    denoDepsDir = this.DENO_DEPS_DIR
  ): Promise<DenoModule> {
    let remote = false;
    const raw = moduleName;
    let filepath: string;

    // import from local
    if (/^file:\/\//.test(moduleName)) {
      filepath = moduleName.replace(/^file:\/\//, "");
    }
    // import from remote
    else if (/^https?:\/\/.+/.test(moduleName)) {
      remote = true;
      moduleName = path.resolve(
        denoDepsDir,
        moduleName.replace("://", "/").replace(/\//g, path.sep)
      );

      filepath = moduleName.replace(/\//g, path.sep);

      // if file not exist, fallback to headers.json
      if (!ts.sys.fileExists(filepath)) {
        const headersPath = `${filepath}.headers.json`;
        if (ts.sys.fileExists(headersPath)) {
          let headers: ModuleHeaders = {
            mime_type: "application/typescript"
          };
          try {
            headers = JSON.parse(
              await fs.readFile(headersPath, { encoding: "utf8" })
            );
          } catch {}

          // follow redirect
          if (headers.redirect_to && headers.redirect_to !== raw) {
            filepath = (
              await this.resolveModule(
                importMaps,
                importerFolder,
                headers.redirect_to,
                denoDepsDir
              )
            ).filepath;
          }
        }
      }
    }
    // ordinary file path
    else {
      // resolve module from Import Maps
      // eg.
      // import "http/server.ts"

      // {
      //   "imports": {
      //      "http": "https://deno.land/std/http"
      //   }
      // }
      //
      moduleName = this._resolveModuleFromImportMap(importMaps, moduleName);

      // if module is a absolute path
      if (moduleName.indexOf("/") === 0 || path.isAbsolute(moduleName)) {
        filepath = moduleName.replace(/\//g, path.sep);
      } else if (/^https?:\/\/.+/.test(moduleName)) {
        const resolvedModule = await this.resolveModule(
          importMaps,
          importerFolder,
          moduleName,
          denoDepsDir
        );

        filepath = resolvedModule.filepath;
        remote = resolvedModule.remote;
      } else {
        filepath = path.resolve(
          importerFolder,
          moduleName.replace(/\//g, path.sep)
        );
      }
    }

    return {
      filepath,
      raw,
      remote
    };
  }
  private getDenoDir(): string {
    let denoDir = process.env.DENO_DIR;

    if (denoDir) {
      return denoDir;
    }

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

    return denoDir;
  }
  private async getExecutablePath(): Promise<string | undefined> {
    const denoPath = await which("deno").catch(() =>
      Promise.resolve(undefined)
    );

    return denoPath;
  }
  private async getDenoVersion(): Promise<Version | undefined> {
    const { stdout, stderr } = await execa(this.executablePath as string, [
      "eval",
      "console.log(JSON.stringify(Deno.version))"
    ]);

    if (stderr) {
      return;
    }

    const { deno, v8, typescript } = JSON.parse(stdout);

    return {
      deno,
      v8,
      typescript,
      raw: `deno: ${deno}\nv8: ${v8}\ntypescript: ${typescript}`
    };
  }
}

const deno = new Deno();

export { deno };

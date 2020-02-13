import { Readable } from "stream";
import * as path from "path";
import { promises as fs } from "fs";

import * as ts from "typescript";
import execa from "execa";
import which from "which";
import { localize } from "vscode-nls-i18n";

type Version = {
  deno: string;
  v8: string;
  typescript: string;
  raw: string;
};

type DenoModule = {
  filepath: string;
  raw: string;
  remote: boolean;
};

type ImportMap = {
  imports: { [key: string]: string };
};

export type FormatableLanguages =
  | "typescript"
  | "typescriptreact"
  | "javascript"
  | "javascriptreact"
  | "markdown"
  | "json";

type PrettierParser = "typescript" | "babel" | "markdown" | "json";

type FormatOptions = {
  cwd: string;
};

type Deps = {
  url: string;
  filepath: string;
};

interface IDenoModuleHeaders {
  mime_type: string;
  redirect_to?: string;
  x_typescript_types?: string;
}

class Deno {
  public version!: Version | void;
  public executablePath!: string | void;
  public readonly DENO_DIR = this.getDenoDir();
  public readonly DENO_DEPS_DIR = path.join(this.DENO_DIR, "deps");
  public readonly dtsFilepath = path.join(
    this.DENO_DIR,
    "lib.deno_runtime.d.ts"
  );
  public async init() {
    this.executablePath = await this.getExecutablePath();

    if (!this.executablePath) {
      throw new Error(localize("err.not_install_deno"));
    }

    this.version = await this.getDenoVersion();
  }
  public async getTypes(): Promise<Buffer> {
    const { stdout } = await execa(this.executablePath as string, ["types"]);

    return Buffer.from(stdout, "utf8");
  }
  // format code
  // echo "console.log(123)" | deno run https://deno.land/std/prettier/main.ts --stdin --stdin-parser=babel
  public async format(
    code: string,
    language: FormatableLanguages,
    options: FormatOptions
  ): Promise<string> {
    let parser: PrettierParser;

    switch (language.toLowerCase()) {
      case "typescript":
      case "typescriptreact":
        parser = "typescript";
        break;
      case "javascript":
      case "javascriptreact":
        parser = "babel";
        break;
      case "markdown":
        parser = "markdown";
        break;
      case "json":
        parser = "json";
        break;
      default:
        return Promise.reject(`Can not format '${language}' code.`);
    }

    const reader = Readable.from([code]);

    const subprocess = execa(
      this.executablePath as string,
      [
        "run",
        "--allow-read",
        `https://deno.land/std@v0.31.0/prettier/main.ts`,
        "--stdin",
        "--stdin-parser",
        parser,
        "--config",
        "auto",
        "--ignore-path",
        "auto"
      ],
      {
        cwd: options.cwd
      }
    );

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
      subprocess.stdout.on("data", (data: Buffer) => {
        stdout += data;
      });

      subprocess.stderr.on("data", (data: Buffer) => {
        stderr += data;
      });

      reader.pipe(subprocess.stdin);
    })) as string;

    return formattedCode;
  }
  private filepath2url(denoModuleFilepath: string): string {
    return denoModuleFilepath
      .replace(deno.DENO_DEPS_DIR, "")
      .replace(/^(\/|\\\\)/, "")
      .replace(/^http(\/|\\\\)/, "http://")
      .replace(/^https(\/|\\\\)/, "https://");
  }
  // get deno dependencies files
  public async getDependencies(
    rootDir = this.DENO_DEPS_DIR,
    deps: Deps[] = []
  ) {
    const files = await fs.readdir(rootDir);

    const promises = files.map(filename => {
      const filepath = path.join(rootDir, filename);
      return fs.stat(filepath).then(stat => {
        const isInternalModule =
          filename.startsWith("_") || filename.startsWith(".");
        if (stat.isDirectory() && !isInternalModule) {
          return this.getDependencies(filepath, deps);
        } else if (
          stat.isFile() &&
          filepath.endsWith(".headers.json") &&
          !isInternalModule
        ) {
          const moduleFilepath = filepath.replace(/\.headers\.json$/, "");

          deps.push({
            url: this.filepath2url(moduleFilepath),
            filepath: moduleFilepath
          });
        }
      });
    });

    await Promise.all(promises);

    return deps;
  }
  public getImportMaps(importMapFilepath: string, workspaceDir: string) {
    let importMaps: ImportMap = {
      imports: {}
    };

    //  try resolve import maps
    if (importMapFilepath) {
      const importMapsFilepath = path.isAbsolute(importMapFilepath)
        ? importMapFilepath
        : path.resolve(workspaceDir || process.cwd(), importMapFilepath);

      if (ts.sys.fileExists(importMapsFilepath)) {
        const importMapContent = ts.sys.readFile(importMapsFilepath);

        try {
          importMaps = JSON.parse(importMapContent || "{}");
        } catch {}
      }
    }

    return importMaps;
  }
  private resolveModuleFromImportMap(
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
    moduleName: string
  ): Promise<DenoModule> {
    let remote = false;
    const raw = moduleName;
    if (/^https?:\/\/.+/.test(moduleName)) {
      remote = true;
      moduleName = path.resolve(
        this.DENO_DEPS_DIR,
        moduleName.replace("://", "/")
      );

      // if file not exist, fallback to headers.json
      if (!ts.sys.fileExists(moduleName)) {
        const headersPath = `${moduleName}.headers.json`;
        if (ts.sys.fileExists(headersPath)) {
          let headers: IDenoModuleHeaders = {
            mime_type: "application/typescript"
          };
          try {
            headers = JSON.parse(
              await fs.readFile(headersPath, { encoding: "utf8" })
            );
          } catch {}

          if (headers.redirect_to && headers.redirect_to !== raw) {
            moduleName = (
              await this.resolveModule(
                importMaps,
                importerFolder,
                headers.redirect_to
              )
            ).filepath;
          }
        }
      }
    } // absolute filepath
    else if (moduleName.indexOf("/") === 0) {
      moduleName = moduleName;
    } // relative filepath
    else {
      moduleName = this.resolveModuleFromImportMap(importMaps, moduleName);

      if (/^https?:\/\/.+/.test(moduleName)) {
        return this.resolveModule(importMaps, importerFolder, moduleName);
      } else {
        moduleName = path.resolve(importerFolder, moduleName);
      }
    }

    return {
      filepath: moduleName,
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

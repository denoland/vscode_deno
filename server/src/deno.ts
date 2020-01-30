import { Readable } from "stream";
import execa from "execa";
import which from "which";

interface Version {
  deno: string;
  v8: string;
  typescript: string;
  raw: string;
}

export type FormatableLanguages =
  | "typescript"
  | "typescriptreact"
  | "javascript"
  | "javascriptreact"
  | "markdown"
  | "json";

type PrettierParser = "typescript" | "babel" | "markdown" | "json";

interface FormatOptions {
  cwd: string;
}

class Deno {
  public version!: Version | void;
  public executablePath!: string | void;
  public DENO_DIR = this.getDenoDir();
  constructor() {}
  public async init() {
    this.executablePath = await this.getExecutablePath();

    if (!this.executablePath) {
      throw new Error(
        "Can not found deno in $PATH. Please restart the extension after setting."
      );
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

    const version = this.version ? this.version.deno : undefined;

    const subprocess = execa(
      this.executablePath as string,
      [
        "run",
        "--allow-read",
        `https://deno.land/std${
          version ? "@v" + version : ""
        }/prettier/main.ts`,
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
  private getDenoDir(): string {
    let denoDir = process.env["DENO_DIR"];

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
        denoDir = `${process.env.HOME}/.cache/deno`;
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

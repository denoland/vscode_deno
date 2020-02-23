import { Readable } from "stream";

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

type FormatOptions = {
  cwd: string;
};

class Deno {
  public version!: Version | void;
  public executablePath!: string | void;
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

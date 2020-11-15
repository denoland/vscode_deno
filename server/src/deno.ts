import { Readable } from "stream";

import execa from "execa";
import which from "which";
import * as semver from "semver";
import { Cache } from "../../core/cache";

type Version = {
  deno: string;
  v8: string;
  typescript: string;
  raw: string;
};

type FormatOptions = {
  cwd: string;
};

interface LintLocation {
  line: number; // one base number
  col: number; // zero base number
}

interface LintDiagnostic {
  code: string;
  filename: string;
  message: string;
  range: {
    start: LintLocation;
    end: LintLocation;
  };
}

interface LintError {
  file_path: string;
  message: string;
}

interface LintOutput {
  diagnostics: LintDiagnostic[];
  errors: LintError[];
}

interface LintRule {
  code: string;
  tags: string[];
  docs?: string;
}

// caching Deno lint's rules for 120s or 100 referenced times
const denoLintRulesCache = Cache.create<LintRule[]>(1000 * 120, 100);

class Deno {
  public version!: Version | void;
  public executablePath!: string | void;
  public async init() {
    this.executablePath = await this.getExecutablePath();

    if (!this.executablePath) {
      throw new Error(
        "Could not find `deno` in your $PATH. Please install `deno`, then restart the extension."
      );
    }

    this.version = await this.getDenoVersion();

    if (!this.version) {
      return;
    }

    // If the currently used Deno is less than 1.4.3
    // We will give an warning to upgrade.
    const minimumDenoVersion = "1.5.3";
    if (!semver.gte(this.version.deno, minimumDenoVersion)) {
      throw new Error(`Please upgrade to Deno ${minimumDenoVersion} or above.`);
    }
  }
  public async getTypes(unstable: boolean): Promise<Buffer> {
    const { stdout } = await execa(this.executablePath as string, [
      "types",
      ...(unstable ? ["--unstable"] : []),
    ]);

    return Buffer.from(stdout, "utf8");
  }
  // format code
  // echo "console.log(123)" | deno fmt -
  public async format(code: string, options: FormatOptions): Promise<string> {
    const reader = Readable.from([code]);

    const subprocess = execa(this.executablePath as string, ["fmt", "-"], {
      cwd: options.cwd,
      stdout: "pipe",
      stderr: "pipe",
      stdin: "pipe",
      env: {
        NO_COLOR: "1",
      },
    });

    const formattedCode = (await new Promise((resolve, reject) => {
      let stdout = "";
      let stderr = "";
      subprocess.on("exit", (exitCode: number) => {
        if (exitCode !== 0) {
          reject(new Error(stderr));
        } else {
          resolve(stdout);
        }
      });
      subprocess.on("error", (err: Error) => reject(err));
      subprocess.stdout?.on("data", (data: Buffer) => (stdout += data));
      subprocess.stderr?.on("data", (data: Buffer) => (stderr += data));
      subprocess.stdin && reader.pipe(subprocess.stdin);
    })) as string;

    return formattedCode;
  }

  public async getLintRules(): Promise<LintRule[]> {
    const cachedRules = denoLintRulesCache.get();
    if (cachedRules) {
      return cachedRules;
    }
    const subprocess = execa(
      this.executablePath as string,
      ["lint", "--unstable", "--rules", "--json"],
      {
        stdout: "pipe",
        env: {
          NO_COLOR: "1",
        },
      }
    );

    const output = await new Promise<string>((resolve, reject) => {
      let stdout = "";
      subprocess.on("exit", () => resolve(stdout));
      subprocess.on("error", (err: Error) => reject(err));
      subprocess.stdout?.on("data", (data: Buffer) => (stdout += data));
    });

    const rules = JSON.parse(output);

    denoLintRulesCache.set(rules);

    return rules;
  }

  // lint code
  // echo "console.log(123)" | deno lint --unstable --json -
  public async lint(code: string): Promise<LintOutput> {
    const reader = Readable.from([code]);

    const subprocess = execa(
      this.executablePath as string,
      ["lint", "--unstable", "--json", "-"],
      {
        stdin: "pipe",
        stderr: "pipe",
        env: {
          NO_COLOR: "1",
        },
      }
    );

    const output = await new Promise<string>((resolve, reject) => {
      let stderr = "";
      subprocess.on("exit", () => resolve(stderr));
      subprocess.on("error", (err: Error) => reject(err));
      subprocess.stderr?.on("data", (data: Buffer) => (stderr += data));
      subprocess.stdin && reader.pipe(subprocess.stdin);
    });

    return JSON.parse(output) as LintOutput;
  }

  private async getExecutablePath(): Promise<string | undefined> {
    const denoPath = await which("deno").catch(() =>
      Promise.resolve(undefined)
    );

    return denoPath;
  }
  private async getDenoVersion(): Promise<Version | undefined> {
    const { stdout, stderr } = await execa(
      this.executablePath as string,
      ["eval", "console.log(JSON.stringify(Deno.version))"],
      {
        env: {
          NO_COLOR: "1",
        },
      }
    );

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
  }
}

const deno = new Deno();

export { deno };

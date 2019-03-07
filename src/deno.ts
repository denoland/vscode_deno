import * as path from "path";
import * as cp from "child_process";
import * as which from "which";

export interface DenoVersion {
  deno: string;
  v8: string;
  typescript: string;
  raw: string;
}

export interface IDeno {
  path: string;
  version: DenoVersion;
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
    let result =
      this.message +
      " " +
      JSON.stringify(
        {
          exitCode: this.exitCode,
          DenoErrorCode: this.DenoErrorCode,
          DenoCommand: this.DenoCommand,
          stdout: this.stdout,
          stderr: this.stderr
        },
        null,
        2
      );

    if (this.error) {
      result += (<any>this.error).stack;
    }

    return result;
  }
}

export interface IDenoOptions {
  denoPath: string;
  version: string;
  env?: any;
}

export const enum DenoErrorCodes {
  BadConfigFile = "BadConfigFile",
  DenoNotFound = "DenoNotFound",
  CantCreatePipe = "CantCreatePipe",
  CantAccessRemote = "CantAccessRemote",
  RepositoryNotFound = "RepositoryNotFound",
  RepositoryIsLocked = "RepositoryIsLocked",
  BranchNotFullyMerged = "BranchNotFullyMerged",
  NoRemoteReference = "NoRemoteReference",
  InvalidBranchName = "InvalidBranchName",
  BranchAlreadyExists = "BranchAlreadyExists",
  NoLocalChanges = "NoLocalChanges",
  NoStashFound = "NoStashFound",
  LocalChangesOverwritten = "LocalChangesOverwritten",
  NoUpstreamBranch = "NoUpstreamBranch",
  IsInSubmodule = "IsInSubmodule",
  WrongCase = "WrongCase",
  CantLockRef = "CantLockRef",
  CantRebaseMultipleBranches = "CantRebaseMultipleBranches",
  PatchDoesNotApply = "PatchDoesNotApply",
  NoPathFound = "NoPathFound"
}

function parseVersion(raw: string): DenoVersion {
  const [deno, v8, typescript] = raw.split("\n");

  return {
    deno: deno.substr(6),
    v8: v8.substr(4),
    typescript: typescript.substr(12),
    raw
  };
}

export function findDeno(
  hint: string | undefined,
  onLookup: (path: string) => void
): Promise<IDeno> {
  const first = hint
    ? findSpecificDeno(hint, onLookup)
    : Promise.reject<IDeno>(null);

  return first
    .then(undefined, () => {
      switch (process.platform) {
        case "darwin":
          return findDenoDarwin(onLookup);
        case "win32":
          return findDenoWin32(onLookup);
        default:
          return findSpecificDeno("deno", onLookup);
      }
    })
    .then(null, () =>
      Promise.reject(new Error("Deno installation not found."))
    );
}

function findDenoDarwin(onLookup: (path: string) => void): Promise<IDeno> {
  return new Promise<IDeno>((c, e) => {
    cp.exec("which deno", (err, DenoPathBuffer) => {
      if (err) {
        return e("Deno not found");
      }

      const path = DenoPathBuffer.toString().replace(/^\s+|\s+$/g, "");

      function getVersion(path: string) {
        onLookup(path);

        // make sure deno executes
        cp.exec("deno --version", (err, stdout) => {
          if (err) {
            return e("Deno not found");
          }

          return c({ path, version: parseVersion(stdout.trim()) });
        });
      }

      if (path !== "/usr/bin/deno") {
        return getVersion(path);
      }

      // must check if XCode is installed
      cp.exec("xcode-select -p", (err: any) => {
        if (err && err.code === 2) {
          // Deno is not installed, and launching /usr/bin/deno
          // will prompt the user to install it

          return e("Deno not found");
        }

        getVersion(path);
      });
    });
  });
}

function findDenoWin32(onLookup: (path: string) => void): Promise<IDeno> {
  return findSystemDenoWin32(process.env["ProgramW6432"] as string, onLookup)
    .then(undefined, () =>
      findSystemDenoWin32(process.env["ProgramFiles(x86)"] as string, onLookup)
    )
    .then(undefined, () =>
      findSystemDenoWin32(process.env["ProgramFiles"] as string, onLookup)
    )
    .then(undefined, () =>
      findSystemDenoWin32(
        path.join(process.env["LocalAppData"] as string, "Programs"),
        onLookup
      )
    )
    .then(undefined, () => findDenoWin32InPath(onLookup));
}

function findSystemDenoWin32(
  base: string,
  onLookup: (path: string) => void
): Promise<IDeno> {
  if (!base) {
    return Promise.reject<IDeno>("Not found");
  }

  return findSpecificDeno(path.join(base, "deno.exe"), onLookup);
}

function findDenoWin32InPath(onLookup: (path: string) => void): Promise<IDeno> {
  const whichPromise = new Promise<string>((c, e) =>
    which("deno.exe", (err, path) => (err ? e(err) : c(path)))
  );
  return whichPromise.then(path => findSpecificDeno(path, onLookup));
}

function findSpecificDeno(
  path: string,
  onLookup: (path: string) => void
): Promise<IDeno> {
  return new Promise<IDeno>((c, e) => {
    onLookup(path);

    const buffers: Buffer[] = [];
    const child = cp.spawn(path, ["--version"]);
    child.stdout.on("data", (b: Buffer) => buffers.push(b));
    child.on("error", cpErrorHandler(e));
    child.on("exit", code =>
      code
        ? e(new Error("Not found"))
        : c({
            path,
            version: parseVersion(
              Buffer.concat(buffers)
                .toString("utf8")
                .trim()
            )
          })
    );
  });
}

function cpErrorHandler(cb: (reason?: any) => void): (reason?: any) => void {
  return err => {
    if (/ENOENT/.test(err.message)) {
      err = new DenoError({
        error: err,
        message: "Failed to execute deno (ENOENT)",
        DenoErrorCode: DenoErrorCodes.DenoNotFound
      });
    }

    cb(err);
  };
}

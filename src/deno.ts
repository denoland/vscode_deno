import * as path from "path";
import execa from "execa";
import which from "which";

type onLookupFunc = (path: string) => void;

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
  onLookup: onLookupFunc
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

async function findDenoDarwin(onLookup: onLookupFunc): Promise<IDeno> {
  const { stdout: denoPath } = await execa("which", ["deno"]);
  const path = denoPath.toString().replace(/^\s+|\s+$/g, "");

  async function getVersion(path: string): Promise<DenoVersion> {
    onLookup(path);

    // make sure deno executes
    const { stdout } = await execa("deno", ["--version"]);
    return parseVersion(stdout.trim());
  }

  if (path !== "/usr/bin/deno") {
    return { path, version: await getVersion(path) };
  }

  const result = await execa("xcode-select", ["-p"]);

  if (result.exitCode === 2) {
    throw new Error("Deno not found");
  }

  return { path, version: await getVersion(path) };
}

function findDenoWin32(onLookup: onLookupFunc): Promise<IDeno> {
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
  onLookup: onLookupFunc
): Promise<IDeno> {
  if (!base) {
    return Promise.reject<IDeno>("Not found");
  }

  return findSpecificDeno(path.join(base, "deno.exe"), onLookup);
}

function findDenoWin32InPath(onLookup: onLookupFunc): Promise<IDeno> {
  const whichPromise = new Promise<string>((c, e) =>
    which("deno.exe", (err, path) => (err ? e(err) : c(path)))
  );
  return whichPromise.then(path => findSpecificDeno(path, onLookup));
}

async function findSpecificDeno(
  path: string,
  onLookup: onLookupFunc
): Promise<IDeno> {
  onLookup(path);

  const ps = await execa(path, ["version"]);

  if (ps.exitCode) {
    throw new Error("Not found");
  }

  return {
    path,
    version: parseVersion(ps.stdout)
  };
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

// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.

import * as childProcess from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as process from "process";
import * as semver from "semver";
import * as vscode from "vscode";

/** Assert that the condition is "truthy", otherwise throw. */
export function assert(cond: unknown, msg = "Assertion failed."): asserts cond {
  if (!cond) {
    throw new Error(msg);
  }
}

export async function getDenoLspArgs(): Promise<string[]> {
  const version = await getDenoVersion();
  // The --parent-pid <pid> flag was added in 1.11.2.
  if (version == null || semver.lt(version, "1.11.2")) {
    return ["lsp"];
  } else {
    // The --parent-pid flag will cause the deno process to
    // terminate itself when the vscode process no longer exists
    return ["lsp", "--parent-pid", process.pid.toString()];
  }
}

let memoizedVersion: semver.SemVer | undefined;

export async function getDenoVersion(): Promise<semver.SemVer | undefined> {
  if (memoizedVersion === undefined) {
    try {
      const denoCommand = await getDenoCommand();
      const output = await execCommand(`${denoCommand} -V`);
      const result = /[0-9]+\.[0-9]+\.[0-9]+/.exec(output);
      if (result != null) {
        memoizedVersion = new semver.SemVer(result[0]);
      }
    } catch (err) {
      console.error(`Error getting deno version: ${err}`);
    }
  }
  return memoizedVersion;
}

let memoizedCommand: string | undefined;

export async function getDenoCommand(): Promise<string> {
  if (memoizedCommand !== undefined) {
    return memoizedCommand;
  }
  let command = vscode.workspace.getConfiguration("deno").get<string>("path");
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const defaultCommand = await getDefaultDenoCommand();
  if (!command || !workspaceFolders) {
    command = command ?? defaultCommand;
  } else if (!path.isAbsolute(command)) {
    // if sent a relative path, iterate over workspace folders to try and resolve.
    const list = [];
    for (const workspace of workspaceFolders) {
      const dir = path.resolve(workspace.uri.path, command);
      try {
        const stat = await fs.promises.stat(dir);
        if (stat.isFile()) {
          list.push(dir);
        }
      } catch {
        // we simply don't push onto the array if we encounter an error
      }
    }
    command = list.shift() ?? defaultCommand;
  }
  return memoizedCommand = command;
}

function getDefaultDenoCommand() {
  switch (os.platform()) {
    case "win32":
      return getDenoWindowsPath();
    default:
      return Promise.resolve("deno");
  }

  async function getDenoWindowsPath() {
    // Adapted from https://github.com/npm/node-which/blob/master/which.js
    // Within vscode it will do `require("child_process").spawn("deno")`,
    // which will prioritize "deno.exe" on the path instead of a possible
    // higher precedence non-exe executable. This is a problem because, for
    // example, version managers may have a `deno.bat` shim on the path. To
    // ensure the resolution of the `deno` command matches what occurs on the
    // command line, attempt to manually resolve the file path (issue #361).
    const denoCmd = "deno";
    // deno-lint-ignore no-undef
    const pathExtValue = process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM";
    // deno-lint-ignore no-undef
    const pathValue = process.env.PATH ?? "";
    const pathExtItems = splitEnvValue(pathExtValue);
    const pathFolderPaths = splitEnvValue(pathValue);

    for (const pathFolderPath of pathFolderPaths) {
      for (const pathExtItem of pathExtItems) {
        const cmdFilePath = path.join(pathFolderPath, denoCmd + pathExtItem);
        if (await fileExists(cmdFilePath)) {
          return cmdFilePath;
        }
      }
    }

    // nothing found; return back command
    return denoCmd;

    function splitEnvValue(value: string) {
      return value
        .split(";")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    }
  }

  function fileExists(executableFilePath: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      fs.stat(executableFilePath, (err, stat) => {
        resolve(err == null && stat.isFile());
      });
    }).catch(() => {
      // ignore all errors
      return false;
    });
  }
}

function execCommand(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    childProcess.exec(command, (err, stdout, stderr) => {
      if (err) {
        reject(stderr);
      } else {
        resolve(stdout);
      }
    });
  });
}

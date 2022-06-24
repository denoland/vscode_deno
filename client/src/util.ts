// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

import { EXTENSION_NS } from "./constants";

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as process from "process";
import * as vscode from "vscode";

/** Assert that the condition is "truthy", otherwise throw. */
export function assert(cond: unknown, msg = "Assertion failed."): asserts cond {
  if (!cond) {
    throw new Error(msg);
  }
}

export async function getDenoCommand(): Promise<string> {
  let command = getWorkspaceConfigDenoExePath();
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const defaultCommand = await getDefaultDenoCommand();
  if (!command || !workspaceFolders) {
    command = command ?? defaultCommand;
  } else if (!path.isAbsolute(command)) {
    // if sent a relative path, iterate over workspace folders to try and resolve.
    const list = [];
    for (const workspace of workspaceFolders) {
      const commandPath = path.resolve(workspace.uri.fsPath, command);
      if (await fileExists(commandPath)) {
        list.push(commandPath);
      }
    }
    command = list.shift() ?? defaultCommand;
  }
  return command;
}

function getWorkspaceConfigDenoExePath() {
  const exePath = vscode.workspace.getConfiguration(EXTENSION_NS)
    .get<string>("path");
  // it is possible for the path to be blank. In that case, return undefined
  if (typeof exePath === "string" && exePath.trim().length === 0) {
    return undefined;
  } else {
    return exePath;
  }
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

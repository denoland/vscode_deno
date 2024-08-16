// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

import { EXTENSION_NS } from "./constants";

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as process from "process";
import {
  Location,
  Position,
  Range,
  TextDocument,
  workspace,
  WorkspaceFolder,
} from "vscode";
import { JSONVisitor, visit } from "jsonc-parser/lib/esm/main.js";
import { semver } from "./semver";

/** Assert that the condition is "truthy", otherwise throw. */
export function assert(cond: unknown, msg = "Assertion failed."): asserts cond {
  if (!cond) {
    throw new Error(msg);
  }
}

/** Returns the absolute path to an existing deno command or
 * the "deno" command name if not found. */
export async function getDenoCommandName() {
  return await getDenoCommandPath() ?? "deno";
}

/** Returns the absolute path to an existing deno command. */
export async function getDenoCommandPath() {
  const command = getWorkspaceConfigDenoExePath();
  const workspaceFolders = workspace.workspaceFolders;
  if (!command || !workspaceFolders) {
    return command ?? await getDefaultDenoCommand();
  } else if (!path.isAbsolute(command)) {
    // if sent a relative path, iterate over workspace folders to try and resolve.
    for (const workspace of workspaceFolders) {
      const commandPath = path.resolve(workspace.uri.fsPath, command);
      if (await fileExists(commandPath)) {
        return commandPath;
      }
    }
    return undefined;
  } else {
    return command;
  }
}

function getWorkspaceConfigDenoExePath() {
  const exePath = workspace.getConfiguration(EXTENSION_NS)
    .get<string>("path");
  // it is possible for the path to be blank. In that case, return undefined
  if (typeof exePath === "string" && exePath.trim().length === 0) {
    return undefined;
  } else {
    return exePath;
  }
}

async function getDefaultDenoCommand() {
  // Adapted from https://github.com/npm/node-which/blob/master/which.js
  // Within vscode it will do `require("child_process").spawn("deno")`,
  // which will prioritize "deno.exe" on the path instead of a possible
  // higher precedence non-exe executable. This is a problem because, for
  // example, version managers may have a `deno.bat` shim on the path. To
  // ensure the resolution of the `deno` command matches what occurs on the
  // command line, attempt to manually resolve the file path (issue #361).
  const denoCmd = "deno";
  const pathValue = process.env.PATH ?? "";
  const pathFolderPaths = splitEnvValue(pathValue);
  // resolve the default install location in case it's not on the PATH
  pathFolderPaths.push(getUserDenoBinDir());
  const pathExts = getPathExts();
  const cmdFileNames = pathExts == null
    ? [denoCmd]
    : pathExts.map((ext) => denoCmd + ext);

  for (const pathFolderPath of pathFolderPaths) {
    for (const cmdFileName of cmdFileNames) {
      const cmdFilePath = path.join(pathFolderPath, cmdFileName);
      if (await fileExists(cmdFilePath)) {
        return cmdFilePath;
      }
    }
  }

  // nothing found
  return undefined;

  function getPathExts() {
    if (os.platform() === "win32") {
      const pathExtValue = process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM";
      return splitEnvValue(pathExtValue);
    } else {
      return undefined;
    }
  }

  function splitEnvValue(value: string) {
    const pathSplitChar = os.platform() === "win32" ? ";" : ":";
    return value
      .split(pathSplitChar)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  function getUserDenoBinDir() {
    return path.join(os.homedir(), ".deno", "bin");
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

export function getInspectArg(denoVersion?: string) {
  if (
    denoVersion && semver.valid(denoVersion) &&
    semver.satisfies(denoVersion, ">=1.29.0")
  ) {
    return "--inspect-wait";
  } else {
    return "--inspect-brk";
  }
}

export function isWorkspaceFolder(value: unknown): value is WorkspaceFolder {
  return typeof value === "object" && value != null &&
    (value as WorkspaceFolder).name !== undefined;
}

export interface TaskDefinitionRange {
  name: string;
  command: string;
  nameRange: Range;
  commandRange: Range;
}

export function readTaskDefinitions(
  document: TextDocument,
  content = document.getText(),
) {
  let depth = 0;
  let start: Position | undefined;
  let end: Position | undefined;
  let inTasks = false;
  let currentTask: { name: string; nameRange: Range } | undefined;

  const tasks: TaskDefinitionRange[] = [];
  const visitor: JSONVisitor = {
    onObjectBegin() {
      depth++;
    },
    onObjectEnd(offset) {
      if (inTasks) {
        end = document.positionAt(offset);
        inTasks = false;
      }
      depth--;
    },
    onLiteralValue(value: unknown, offset: number, length: number) {
      if (currentTask && typeof value === "string") {
        tasks.push({
          ...currentTask,
          command: value,
          commandRange: new Range(
            document.positionAt(offset),
            document.positionAt(offset + length),
          ),
        });
        currentTask = undefined;
      }
    },
    onObjectProperty(property: string, offset: number, length: number) {
      if (depth === 1 && property === "tasks") {
        inTasks = true;
        start = document.positionAt(offset);
      } else if (inTasks) {
        currentTask = {
          name: property,
          nameRange: new Range(
            document.positionAt(offset),
            document.positionAt(offset + length),
          ),
        };
      }
    },
  };

  visit(content, visitor);

  if (start === undefined) {
    return undefined;
  }

  return {
    location: new Location(document.uri, new Range(start, end ?? start)),
    tasks,
  };
}

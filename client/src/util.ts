// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

import { type ApprovedConfigPaths, getDenoPathInfo } from "./config_paths";
import { EXTENSION_NS } from "./constants";

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as process from "process";
import {
  Location,
  Range,
  TextDocument,
  workspace,
  WorkspaceFolder,
} from "vscode";
import * as jsoncParser from "jsonc-parser/lib/esm/main.js";
import { semver } from "./semver";
import type { DenoInfoJson } from "./types";
import { spawnSync } from "child_process";
import type * as vscode from "vscode";

/** Assert that the condition is "truthy", otherwise throw. */
export function assert(cond: unknown, msg = "Assertion failed."): asserts cond {
  if (!cond) {
    throw new Error(msg);
  }
}

/** Returns the absolute path to an existing deno command or
 * the "deno" command name if not found. */
export async function getDenoCommandName(approvedPaths: ApprovedConfigPaths) {
  return await getDenoCommandPath(approvedPaths) ?? "deno";
}

/** Returns the absolute path to an existing deno command.
 * Returns undefined if the path is not approved by the user. */
export async function getDenoCommandPath(approvedPaths: ApprovedConfigPaths) {
  const pathInfo = getDenoPathInfo();

  // check for approval if using a workspace-configured path
  const approved = await approvedPaths.promptForApproval(pathInfo);
  if (!approved) {
    return await getDefaultDenoCommand();
  }

  const command = pathInfo?.path;
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

export async function getDenoInfoJson(
  outputChannel: vscode.OutputChannel,
  approvedPaths: ApprovedConfigPaths,
): Promise<DenoInfoJson | null> {
  try {
    const command = await getDenoCommandName(approvedPaths);
    const { stdout, stderr, status, error } = spawnSync(command, [
      "info",
      "--json",
    ], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        "NO_COLOR": "1",
      },
    });
    if (error) {
      throw error;
    }
    if (status != 0) {
      throw `Command failed: ${stderr}`;
    }
    return JSON.parse(stdout);
  } catch (error) {
    outputChannel.appendLine(
      `Couldn't get 'deno info --json' output: ${error}`,
    );
    return null;
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
  valueRange: Range;
}

export function readTaskDefinitions(
  document: TextDocument,
  content = document.getText(),
) {
  const root = jsoncParser.parseTree(content);
  if (!root) {
    return undefined;
  }
  if (root.type != "object" || !root.children) {
    return undefined;
  }
  const tasksProperty = root.children.find((n) =>
    n.type == "property" && n.children?.[0]?.value == "tasks"
  );
  if (!tasksProperty) {
    return undefined;
  }
  const tasksValue = tasksProperty.children?.[1];
  if (!tasksValue || tasksValue.type != "object" || !tasksValue.children) {
    return undefined;
  }
  const tasks: TaskDefinitionRange[] = [];
  for (const taskProperty of tasksValue.children) {
    const taskKey = taskProperty.children?.[0];
    if (
      taskProperty.type != "property" || !taskKey || taskKey.type != "string"
    ) {
      continue;
    }
    const taskValue = taskProperty.children?.[1];
    if (!taskValue) {
      continue;
    }
    let command;
    if (taskValue.type == "string") {
      command = taskValue.value;
    } else if (taskValue.type == "object" && taskValue.children) {
      const commandProperty = taskValue.children.find((n) =>
        n.type == "property" && n.children?.[0]?.value == "command"
      );
      if (!commandProperty) {
        continue;
      }
      const commandValue = commandProperty.children?.[1];
      if (!commandValue || commandValue.type != "string") {
        continue;
      }
      command = commandValue.value;
    } else {
      continue;
    }
    tasks.push({
      name: taskKey.value,
      nameRange: new Range(
        document.positionAt(taskKey.offset),
        document.positionAt(taskKey.offset + taskKey.length),
      ),
      command,
      valueRange: new Range(
        document.positionAt(taskValue.offset),
        document.positionAt(taskValue.offset + taskValue.length),
      ),
    });
  }

  return {
    location: new Location(
      document.uri,
      new Range(
        document.positionAt(tasksProperty.offset),
        document.positionAt(tasksProperty.offset + tasksProperty.length),
      ),
    ),
    tasks,
  };
}

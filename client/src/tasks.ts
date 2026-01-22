// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

import * as path from "path";
import type { DenoExtensionContext } from "./types";
import { getDenoCommandName, isWorkspaceFolder } from "./util";

import * as vscode from "vscode";

export const TASK_TYPE = "deno";
export const TASK_SOURCE = "deno";

interface DenoConfigTaskDefinition extends vscode.TaskDefinition {
  name: string;
  detail?: string;
}

export interface DenoTaskDefinition extends vscode.TaskDefinition {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export function buildDenoTask(
  target: vscode.WorkspaceFolder,
  process: string,
  definition: DenoTaskDefinition,
  name: string,
  args: string[],
  problemMatchers: string[],
): vscode.Task {
  const exec = new vscode.ProcessExecution(
    process,
    args,
    definition,
  );

  return new vscode.Task(
    definition,
    target,
    name,
    TASK_SOURCE,
    exec,
    problemMatchers,
  );
}

export function buildDenoConfigTask(
  scope: vscode.WorkspaceFolder,
  process: string,
  name: string,
  command: string | undefined,
  sourceUri?: vscode.Uri,
  description: string = "",
): vscode.Task {
  const args = [];
  if (
    sourceUri &&
    vscode.Uri.joinPath(sourceUri, "..").toString() != scope.uri.toString()
  ) {
    const configPath = path.relative(scope.uri.fsPath, sourceUri.fsPath);
    args.push("-c", configPath);
  }
  args.push(name);
  const task = new vscode.Task(
    {
      type: TASK_TYPE,
      name: name,
      command: "task",
      args,
      sourceUri,
    },
    scope,
    name,
    TASK_SOURCE,
    new vscode.ProcessExecution(process, ["task", ...args]),
    ["$deno"],
  );
  task.detail = description || `$ ${command}`;
  return task;
}

function isDenoTaskDefinition(
  value: vscode.TaskDefinition,
): value is DenoTaskDefinition {
  return value.type === TASK_TYPE && typeof value.command !== "undefined";
}

function isDenoConfigTaskDefinition(
  value: vscode.TaskDefinition,
): value is DenoConfigTaskDefinition {
  return value.type === TASK_TYPE && typeof value.name !== "undefined";
}

class DenoTaskProvider implements vscode.TaskProvider {
  #extensionContext: DenoExtensionContext;

  constructor(extensionContext: DenoExtensionContext) {
    this.#extensionContext = extensionContext;
  }

  async provideTasks(): Promise<vscode.Task[]> {
    const defs = [
      {
        command: "bundle",
        group: vscode.TaskGroup.Build,
        problemMatchers: ["$deno"],
      },
      {
        command: "cache",
        group: vscode.TaskGroup.Build,
        problemMatchers: ["$deno"],
      },
      {
        command: "compile",
        group: vscode.TaskGroup.Build,
        problemMatchers: ["$deno"],
      },
      {
        command: "lint",
        group: vscode.TaskGroup.Test,
        problemMatchers: ["$deno-lint"],
      },
      { command: "run", group: undefined, problemMatchers: ["$deno"] },
      {
        command: "test",
        group: vscode.TaskGroup.Test,
        problemMatchers: ["$deno-test"],
      },
      { command: "upgrade", group: undefined, problemMatchers: ["$deno"] },
    ];

    const tasks: vscode.Task[] = [];

    const process = await getDenoCommandName(this.#extensionContext.approvedPaths);
    for (const workspaceFolder of vscode.workspace.workspaceFolders ?? []) {
      for (const { command, group, problemMatchers } of defs) {
        const task = buildDenoTask(
          workspaceFolder,
          process,
          { type: TASK_TYPE, command },
          command,
          [command],
          problemMatchers,
        );
        task.group = group;
        tasks.push(task);
      }
    }

    return tasks;
  }

  async resolveTask(task: vscode.Task): Promise<vscode.Task | undefined> {
    const { definition } = task;

    if (isDenoTaskDefinition(definition)) {
      const args = [definition.command].concat(definition.args ?? []);
      if (isWorkspaceFolder(task.scope)) {
        return buildDenoTask(
          task.scope,
          await getDenoCommandName(this.#extensionContext.approvedPaths),
          definition,
          task.name,
          args,
          task.problemMatchers,
        );
      }
    } else if (isDenoConfigTaskDefinition(definition)) {
      if (isWorkspaceFolder(task.scope)) {
        return buildDenoConfigTask(
          task.scope,
          await getDenoCommandName(this.#extensionContext.approvedPaths),
          definition.name,
          definition.detail,
        );
      }
    }
  }
}

export function activateTaskProvider(
  extensionContext: DenoExtensionContext,
): vscode.Disposable {
  const provider = new DenoTaskProvider(extensionContext);
  return vscode.tasks.registerTaskProvider(TASK_TYPE, provider);
}

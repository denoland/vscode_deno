// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.

import { task as taskReq } from "./lsp_extensions";
import type { DenoExtensionContext } from "./types";
import { getDenoCommand } from "./util";

import * as vscode from "vscode";

export const TASK_TYPE = "deno";
export const TASK_SOURCE = "deno";
export const TASK_CONFIG_SOURCE = "deno task";

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

function buildDenoConfigTask(
  scope: vscode.WorkspaceFolder,
  process: string,
  name: string,
  detail?: string,
): vscode.Task {
  const execution = new vscode.ProcessExecution(process, ["task", name]);

  const task = new vscode.Task(
    { type: TASK_TYPE, name, detail },
    scope,
    name,
    TASK_CONFIG_SOURCE,
    execution,
    ["$deno"],
  );
  task.detail = detail;
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

function isWorkspaceFolder(value: unknown): value is vscode.WorkspaceFolder {
  return typeof value === "object" && value != null &&
    (value as vscode.WorkspaceFolder).name !== undefined;
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
    ];

    const tasks: vscode.Task[] = [];

    const process = await getDenoCommand();
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

    // we retrieve config tasks from the language server, if the language server
    // supports the capability
    const client = this.#extensionContext.client;
    const supportsConfigTasks = this.#extensionContext.serverCapabilities
      ?.experimental?.denoConfigTasks;
    if (client && supportsConfigTasks) {
      const configTasks = await client.sendRequest(taskReq, {});
      for (const workspaceFolder of vscode.workspace.workspaceFolders ?? []) {
        if (configTasks) {
          for (const { name, detail } of configTasks) {
            tasks.push(
              buildDenoConfigTask(workspaceFolder, process, name, detail),
            );
          }
        }
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
          await getDenoCommand(),
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
          await getDenoCommand(),
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

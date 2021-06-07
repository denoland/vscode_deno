// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.

import { getDenoCommand } from "./util";

import * as vscode from "vscode";

export const TASK_TYPE = "deno";
export const TASK_SOURCE = "deno";

export interface DenoTaskDefinition extends vscode.TaskDefinition {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export async function buildDenoTask(
  target: vscode.WorkspaceFolder,
  definition: DenoTaskDefinition,
  name: string,
  args: string[],
  problemMatchers: string[],
): Promise<vscode.Task> {
  const exec = new vscode.ProcessExecution(
    await getDenoCommand(),
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

function isWorkspaceFolder(value: unknown): value is vscode.WorkspaceFolder {
  return typeof value === "object" && value != null &&
    (value as vscode.WorkspaceFolder).name !== undefined;
}

class DenoTaskProvider implements vscode.TaskProvider {
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
    for (const workspaceFolder of vscode.workspace.workspaceFolders ?? []) {
      for (const { command, group, problemMatchers } of defs) {
        const task = await buildDenoTask(
          workspaceFolder,
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
    const definition = task.definition as DenoTaskDefinition;

    if (definition.type === TASK_TYPE && definition.command) {
      const args = [definition.command].concat(definition.args ?? []);
      if (isWorkspaceFolder(task.scope)) {
        return await buildDenoTask(
          task.scope,
          definition,
          task.name,
          args,
          task.problemMatchers,
        );
      }
    }
  }
}

export function activateTaskProvider(): vscode.Disposable {
  const provider = new DenoTaskProvider();
  return vscode.tasks.registerTaskProvider(TASK_TYPE, provider);
}

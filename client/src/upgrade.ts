// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

import { EXTENSION_NS } from "./constants";
import * as tasks from "./tasks";
import { UpgradeAvailable } from "./types";
import { assert, getDenoCommandName } from "./util";
import * as vscode from "vscode";

export async function denoUpgradePromptAndExecute(
  { latestVersion, isCanary }: UpgradeAvailable,
) {
  const config = vscode.workspace.getConfiguration(EXTENSION_NS);
  let prompt = isCanary
    ? `A new canary release of Deno is available: ${latestVersion.slice(0, 7)}.`
    : `A new release of Deno is available: ${latestVersion}.`;
  prompt += " Would you like to upgrade?";
  const selection = await vscode.window.showInformationMessage(
    prompt,
    "Upgrade",
    "Dismiss",
  );
  if (selection !== "Upgrade") {
    return;
  }
  const args = ["upgrade"];
  if (config.get("unstable")) {
    args.push("--unstable");
  }
  if (isCanary) {
    args.push("--canary");
  }
  args.push("--version");
  args.push(latestVersion);
  const env = {} as Record<string, string>;
  const cacheDir: string | undefined | null = config.get("cache");
  if (cacheDir?.trim()) {
    env["DENO_DIR"] = cacheDir.trim();
  }
  const definition: tasks.DenoTaskDefinition = {
    type: tasks.TASK_TYPE,
    command: "upgrade",
    args,
    env,
  };
  assert(vscode.workspace.workspaceFolders);
  const target = vscode.workspace.workspaceFolders[0];
  const denoCommand = await getDenoCommandName();
  const task = tasks.buildDenoTask(
    target,
    denoCommand,
    definition,
    "upgrade",
    args,
    ["$deno"],
  );
  task.presentationOptions = {
    reveal: vscode.TaskRevealKind.Always,
    panel: vscode.TaskPanelKind.Dedicated,
    clear: true,
  };
  const execution = await vscode.tasks.executeTask(task);
  const disposable = vscode.tasks.onDidEndTask((event) => {
    if (event.execution == execution) {
      disposable.dispose();
      vscode.commands.executeCommand("deno.client.restart");
    }
  });
}

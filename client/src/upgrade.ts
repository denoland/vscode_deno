// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

import { readFileSync } from "fs";
import { EXTENSION_NS } from "./constants";
import * as tasks from "./tasks";
import { UpgradeAvailable } from "./types";
import { assert, getDenoCommandName } from "./util";
import * as dotenv from "dotenv";
import * as vscode from "vscode";
import { join } from "path";

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
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  const env = {} as Record<string, string>;
  const denoEnvFile = config.get<string>("envFile");
  if (denoEnvFile) {
    if (workspaceFolder) {
      const denoEnvPath = join(workspaceFolder.uri.fsPath, denoEnvFile);
      try {
        const content = readFileSync(denoEnvPath, { encoding: "utf8" });
        const parsed = dotenv.parse(content);
        Object.assign(env, parsed);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Could not read env file "${denoEnvPath}": ${process.cwd()} ${error}`,
        );
      }
    }
  }
  const denoEnv = config.get<Record<string, string>>("env");
  if (denoEnv) {
    Object.assign(env, denoEnv);
  }
  const cacheDir: string | undefined | null = config.get("cache");
  if (cacheDir?.trim()) {
    env["DENO_DIR"] = cacheDir.trim();
  }
  if (config.get<boolean>("future")) {
    env["DENO_FUTURE"] = "1";
  }
  const definition: tasks.DenoTaskDefinition = {
    type: tasks.TASK_TYPE,
    command: "upgrade",
    args,
    env,
  };
  assert(workspaceFolder);
  const denoCommand = await getDenoCommandName();
  const task = tasks.buildDenoTask(
    workspaceFolder,
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

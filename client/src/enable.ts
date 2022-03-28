// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

import { ENABLE, ENABLE_PATHS, EXTENSION_NS } from "./constants";

import * as vscode from "vscode";

async function exists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
  } catch {
    return false;
  }
  return true;
}

/**
 * @param folder the workspace folder to prompt about enablement
 * @param only the workspace contains only a single folder or not
 */
async function promptEnableWorkspaceFolder(
  folder: vscode.WorkspaceFolder,
  only: boolean,
): Promise<boolean> {
  const prompt = only
    ? `The workspace appears to be a Deno workspace. Do you wish to enable the Deno extension for this workspace?`
    : `The workspace folder named "${folder.name}" appears to be a Deno workspace. Do you wish to enable the Deno extension for this workspace folder?`;
  const selection = await vscode.window.showInformationMessage(
    prompt,
    "No",
    "Enable",
  );
  return selection === "Enable";
}

/** Iterate over the workspace folders, checking if the workspace isn't
 * explicitly enabled or disabled, and if there is a Deno config file in the
 * root of the workspace folder, offer to enable it. */
async function checkEnabledWorkspaceFolders() {
  if (!vscode.workspace.workspaceFolders) {
    return;
  }
  const only = vscode.workspace.workspaceFolders.length === 1;
  for (const workspaceFolder of vscode.workspace.workspaceFolders) {
    const config = vscode.workspace.getConfiguration(
      EXTENSION_NS,
      workspaceFolder,
    );
    const enable = config.inspect<boolean>(ENABLE);
    // the workspace folder, workspace or user settings have been explicitly
    // enabled/disabled so we should skip
    if (
      typeof enable?.workspaceFolderValue !== "undefined" ||
      typeof enable?.workspaceValue !== "undefined" ||
      typeof enable?.globalValue !== "undefined"
    ) {
      continue;
    }
    const enabledPaths = config.get<string[]>(ENABLE_PATHS);
    // if specific paths are already enabled, we should skip
    if (enabledPaths && enabledPaths.length) {
      continue;
    }
    // if either a deno.json or deno.jsonc exists in the root of the workspace
    // folder, we will prompt the user to enable Deno or not.
    if (
      await exists(vscode.Uri.joinPath(workspaceFolder.uri, "./deno.json")) ||
      await exists(vscode.Uri.joinPath(workspaceFolder.uri, "./deno.jsonc"))
    ) {
      const enable = await promptEnableWorkspaceFolder(workspaceFolder, only);
      // enable can be set on a workspace or workspace folder, when there is
      // only one workspace folder, we still only want to update the config on
      // the workspace, versus the folder
      await config.update(
        "enable",
        enable,
        only
          ? vscode.ConfigurationTarget.Workspace
          : vscode.ConfigurationTarget.WorkspaceFolder,
      );
    }
  }
}

/** Check the current workspace */
export async function setupCheckConfig(): Promise<vscode.Disposable> {
  await checkEnabledWorkspaceFolders();

  const subscriptions: vscode.Disposable[] = [];
  // create a file watcher, so if a config file is added to the workspace we
  // will check enablement
  const configFileWatcher = vscode.workspace.createFileSystemWatcher(
    "**/deno.json{c}",
    false,
    true,
    true,
  );
  subscriptions.push(configFileWatcher);
  subscriptions.push(
    configFileWatcher.onDidCreate(checkEnabledWorkspaceFolders),
  );

  return {
    dispose() {
      for (const disposable of subscriptions) {
        disposable.dispose();
      }
    },
  };
}

// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

import { ENABLE, ENABLE_PATHS, EXTENSION_NS } from "./constants";

import * as vscode from "vscode";

export interface WorkspaceEnabledInfo {
  folder: vscode.WorkspaceFolder;
  enabled: boolean | undefined;
  hasDenoConfig: boolean;
}

export async function getWorkspacesEnabledInfo() {
  const result: WorkspaceEnabledInfo[] = [];
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    result.push({
      folder,
      enabled: await getIsWorkspaceEnabled(folder),
      hasDenoConfig:
        await exists(vscode.Uri.joinPath(folder.uri, "./deno.json")) ||
        await exists(vscode.Uri.joinPath(folder.uri, "./deno.jsonc")),
    });
  }
  return result;

  function getIsWorkspaceEnabled(workspaceFolder: vscode.WorkspaceFolder) {
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
      return config.get<boolean>(ENABLE) ?? false;
    }

    // check for specific paths being enabled
    const enabledPaths = config.get<string[]>(ENABLE_PATHS);
    if (enabledPaths && enabledPaths.length) {
      return true;
    }

    // no setting set, so undefined
    return undefined;
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
  const workspacesEnabledInfo = await getWorkspacesEnabledInfo();
  const only = workspacesEnabledInfo.length === 1;
  for (const enabledInfo of workspacesEnabledInfo) {
    // if the user has not configured enablement and either a deno.json or
    // deno.jsonc exists in the root of the workspace folder, we will prompt
    // the user to enable Deno or not.
    if (enabledInfo.enabled == null && enabledInfo.hasDenoConfig) {
      const enable = await promptEnableWorkspaceFolder(
        enabledInfo.folder,
        only,
      );
      // enable can be set on a workspace or workspace folder, when there is
      // only one workspace folder, we still only want to update the config on
      // the workspace, versus the folder
      const config = vscode.workspace.getConfiguration(
        EXTENSION_NS,
        enabledInfo.folder,
      );
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

// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

import { ENABLE, ENABLE_PATHS, EXTENSION_NS } from "./constants";

import * as vscode from "vscode";

export async function isEnabled() {
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    const isWorkspaceEnabled = await getIsWorkspaceEnabled(folder);
    const hasDenoConfig = await exists(vscode.Uri.joinPath(folder.uri, "./deno.json")) || await exists(vscode.Uri.joinPath(folder.uri, "./deno.jsonc"))
    // when the workspace is explicitly enabled or disabled, we honor it
    // but when it is not set, we enable if deno.json{c} is present.
    if (isWorkspaceEnabled || hasDenoConfig) {
      return true;
    }
  }
  return false;

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
  const subscriptions: vscode.Disposable[] = [];
  // create a file watcher, so if a config file is added to the workspace we
  // will check enablement
  // const configFileWatcher = vscode.workspace.createFileSystemWatcher(
  //   "**/deno.json{c}",
  //   false,
  //   true,
  //   true,
  // );
  // subscriptions.push(configFileWatcher);
  // subscriptions.push(
  //   configFileWatcher.onDidCreate(async () => {
  //     // push enabled to extensionContext
  //     const enabled = await isEnabled();
      
  //   }),
  // );

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

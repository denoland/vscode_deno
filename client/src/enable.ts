// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

import { ENABLE, ENABLE_PATHS, EXTENSION_NS } from "./constants";

import * as vscode from "vscode";
import { DenoExtensionContext } from "./types";

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
export async function setupCheckConfig(
  extensionContext: DenoExtensionContext,
): Promise<vscode.Disposable> {
  async function updateHasDenoConfig() {
    const uri = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!uri) {
      return;
    }
    const prev = extensionContext.hasDenoConfig;
    extensionContext.hasDenoConfig =
      await exists(vscode.Uri.joinPath(uri, "./deno.json")) ||
      await exists(vscode.Uri.joinPath(uri, "./deno.jsonc"));
    if (extensionContext.hasDenoConfig !== prev) {
      extensionContext.tsApi?.refresh();
    }
  }

  await updateHasDenoConfig();

  const subscriptions: vscode.Disposable[] = [];
  // create a file watcher, so if a config file is added to the workspace we
  // will check enablement
  const configFileWatcher = vscode.workspace.createFileSystemWatcher(
    "**/deno.{json,jsonc}",
    false,
    true,
    false,
  );
  subscriptions.push(configFileWatcher);
  subscriptions.push(configFileWatcher.onDidCreate(updateHasDenoConfig));
  subscriptions.push(configFileWatcher.onDidDelete(updateHasDenoConfig));

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

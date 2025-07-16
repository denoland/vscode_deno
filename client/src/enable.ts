// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

import { ENABLE, ENABLE_PATHS, EXTENSION_NS } from "./constants";

import * as vscode from "vscode";
import { DenoExtensionContext, EnableSettings } from "./types";

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
    if (config.get<string[]>(ENABLE_PATHS)) {
      return true;
    }

    // no setting set, so undefined
    return undefined;
  }
}

export function refreshEnableSettings(extensionContext: DenoExtensionContext) {
  function getEnableSettings(
    config: vscode.WorkspaceConfiguration,
    scope: vscode.Uri | null,
  ): EnableSettings {
    const enable = config.get<boolean | null>("enable") ?? null;
    let enablePaths = null;
    let disablePaths: string[] = [];
    if (scope) {
      enablePaths = config.get<string[] | null>("enablePaths")?.map((p) =>
        vscode.Uri.joinPath(scope, p).fsPath
      ) ?? null;
      disablePaths = config.get<string[]>("disablePaths")?.map((p) =>
        vscode.Uri.joinPath(scope, p).fsPath
      ) ?? [];
    }
    return { enable, enablePaths, disablePaths };
  }
  extensionContext.enableSettingsUnscoped = getEnableSettings(
    vscode.workspace.getConfiguration(EXTENSION_NS),
    vscode.workspace.workspaceFolders?.[0]?.uri ?? null,
  );
  extensionContext.enableSettingsByFolder = [];
  const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
  for (const workspaceFolder of workspaceFolders) {
    extensionContext.enableSettingsByFolder.push([
      workspaceFolder.uri.fsPath,
      getEnableSettings(
        vscode.workspace.getConfiguration(EXTENSION_NS, workspaceFolder),
        workspaceFolder.uri,
      ),
    ]);
  }
  extensionContext.enableSettingsByFolder.sort();
  extensionContext.enableSettingsByFolder.reverse();
}

async function exists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
  } catch {
    return false;
  }
  return true;
}

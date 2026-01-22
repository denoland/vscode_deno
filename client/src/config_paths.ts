// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

import * as vscode from "vscode";
import { EXTENSION_NS } from "./constants";

const APPROVED_PATHS_KEY = "deno.approvedPaths";

export interface DenoPathInfo {
  path: string;
  isFromWorkspace: boolean;
}

export function getDenoPathInfo(): DenoPathInfo | undefined {
  const config = vscode.workspace.getConfiguration(EXTENSION_NS);
  const inspection = config.inspect<string>("path");

  const rawPath = config.get<string>("path");
  if (typeof rawPath === "string" && rawPath.trim().length > 0) {
    // check if path is set in workspace or folder settings (not global/user)
    const workspaceValue = inspection?.workspaceValue;
    const folderValue = inspection?.workspaceFolderValue;
    const isFromWorkspace = (typeof workspaceValue === "string" &&
      workspaceValue.trim().length > 0) ||
      (typeof folderValue === "string" && folderValue.trim().length > 0);
    return {
      path: rawPath.trim(),
      isFromWorkspace,
    };
  } else {
    return undefined;
  }
}

export class ApprovedConfigPaths {
  readonly #context: vscode.ExtensionContext;
  readonly #sessionDeniedPaths = new Set<string>();

  constructor(context: vscode.ExtensionContext) {
    this.#context = context;
  }

  #getApprovedPaths(): string[] {
    const value = this.#context.workspaceState.get(APPROVED_PATHS_KEY);
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter((item): item is string => typeof item === "string");
  }

  isPathApproved(path: string): boolean {
    const approvedPaths = this.#getApprovedPaths();
    return approvedPaths.includes(path);
  }

  async #approvePath(path: string): Promise<void> {
    const approvedPaths = this.#getApprovedPaths();
    if (!approvedPaths.includes(path)) {
      approvedPaths.push(path);
      await this.#context.workspaceState.update(
        APPROVED_PATHS_KEY,
        approvedPaths,
      );
    }
  }

  /** Prompts the user for approval if the path hasn't been approved yet. */
  async promptForApproval(
    pathInfo: DenoPathInfo | undefined,
  ): Promise<boolean> {
    // null and global paths don't need approval
    if (pathInfo == null || !pathInfo.isFromWorkspace) {
      return true;
    }

    const path = pathInfo.path;
    if (this.isPathApproved(path)) {
      return true;
    }

    // already denied for this session
    if (this.#sessionDeniedPaths.has(path)) {
      return false;
    }

    const allow = "Allow";
    const deny = "Deny";
    const result = await vscode.window.showWarningMessage(
      `A workspace setting wants to run a custom Deno executable: ${path}`,
      allow,
      deny,
    );

    if (result === allow) {
      await this.#approvePath(path);
      return true;
    }
    if (result === deny) {
      this.#sessionDeniedPaths.add(path);
    }
    return false;
  }
}

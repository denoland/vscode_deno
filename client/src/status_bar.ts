// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

import { DenoExtensionContext } from "./types";

import * as vscode from "vscode";

export class DenoStatusBar {
  readonly #inner: vscode.StatusBarItem;

  constructor() {
    this.#inner = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      0,
    );
    this.#inner.command = "deno.client.statusBarClicked";
  }

  dispose() {
    this.#inner.dispose();
  }

  refresh(extensionContext: DenoExtensionContext) {
    if (extensionContext.serverInfo) {
      this.#inner.text = `Deno ${extensionContext.serverInfo.version}`;
      if (extensionContext.serverInfo.upgradeAvailable) {
        this.#inner.text += " (Upgrade available)";
      }
      this.#inner.tooltip = extensionContext.serverInfo.versionWithBuildInfo;
    }

    // show only when "enable" is true and language server started
    if (
      extensionContext.client && extensionContext.serverInfo &&
      (extensionContext.scopesWithDenoJson?.size ||
        extensionContext.enableSettingsUnscoped.enable ||
        extensionContext.enableSettingsUnscoped.enablePaths?.length ||
        extensionContext.enableSettingsByFolder.find(([_, s]) =>
          s.enable || s.enablePaths?.length
        ))
    ) {
      this.#inner.show();
    } else {
      this.#inner.hide();
    }
  }
}

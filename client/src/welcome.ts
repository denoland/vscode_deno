// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.

import * as vscode from "vscode";
import { EXTENSION_ID } from "./constants";

function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export class WelcomePanel {
  #panel: vscode.WebviewPanel;
  #extensionUri: vscode.Uri;
  #mediaRoot: vscode.Uri;
  #disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.#panel = panel;
    this.#extensionUri = extensionUri;
    this.#mediaRoot = vscode.Uri.joinPath(this.#extensionUri, "media");

    this.#update();

    this.#panel.onDidDispose(() => this.dispose(), null, this.#disposables);

    this.#panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case "openDocument": {
            const uri = vscode.Uri.joinPath(
              this.#extensionUri,
              message.document,
            );
            vscode.commands.executeCommand("markdown.showPreviewToSide", uri);
            return;
          }
          case "openSetting": {
            vscode.commands.executeCommand(
              "workbench.action.openSettings",
              message.setting,
            );
            return;
          }
          case "init": {
            vscode.commands.executeCommand("deno.initializeWorkspace");
            return;
          }
        }
      },
      null,
      this.#disposables,
    );
  }

  dispose() {
    WelcomePanel.currentPanel = undefined;

    this.#panel.dispose();

    for (const handle of this.#disposables) {
      if (handle) {
        handle.dispose();
      }
    }
  }

  #update = () => {
    const { webview } = this.#panel;
    this.#panel.webview.html = this.#getHtmlForWebview(webview);
  };

  #getHtmlForWebview = (webview: vscode.Webview) => {
    const scriptPath = vscode.Uri.joinPath(this.#mediaRoot, "welcome.js");
    const stylesPath = vscode.Uri.joinPath(this.#mediaRoot, "welcome.css");
    const logoPath = vscode.Uri.joinPath(this.#extensionUri, "deno.png");
    const denoExtension = vscode.extensions.getExtension(EXTENSION_ID)!;
    const denoExtensionVersion = denoExtension.packageJSON.version;

    const scriptURI = webview.asWebviewUri(scriptPath);
    const stylesURI = webview.asWebviewUri(stylesPath);
    const logoURI = webview.asWebviewUri(logoPath);

    const nonce = getNonce();

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <!--
          Use a CSP that only allows loading images from https or from our
          extension directory and only allows scripts that have a specific nonce
        -->
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="${stylesURI}" rel="stylesheet">
        <title>Deno for VSCode</title>
      </head>
      <body>
      <main class="Content">
      <div class="Header">
        <img src="${logoURI}" alt="Deno Extension Logo" class="Header-logo" />
        <div class="Header-details">
          <h1 class="Header-title">Deno for VSCode v${denoExtensionVersion}</h1>
          <p>The official Deno extension for Visual Studio Code, powered by the Deno Language Server.</p>
          <ul class="Header-links">
            <li><a href="#" class="Command" data-command="openDocument" data-document="Releases.md">Release notes</a></li>
            <li><a href="https://github.com/denoland/vscode_deno/">GitHub</a></li>
            <li><a href="https://discord.gg/deno">Discord</a></li>
          </ul>
        </div>
      </div>
      
      <div class="Cards">
        <div class="Card">
          <div class="Card-inner">
          <p class="Card-title">Enabling Deno</p>
          <p class="Card-content">
            <p>
              The extension does not assume it applies to all workspaces you use
              with VSCode. You can enable Deno in a workspace by running the
              <em><a href="#" class="Command" data-command="init">Deno:
              Initialize Workspace Configuration</a></em> command.
            </p>
            <p>
              You can also enable or disable it in the
              <a href="#" class="Command" data-command="openSetting" data-setting="deno.enable">settings</a>.
              <em>It is not recommended to enable it globally, unless of course
              you only edit Deno projects with VSCode.</em>
            </p>
          </p>
          </div>
        </div>

        <div class="Card">
          <div class="Card-inner">
            <p class="Card-title">Getting started with Deno</p>
            <p class="Card-content">
              If you are new to Deno, check out the
              <a href="https://deno.land/manual/getting_started">getting started
              section</a> of the Deno manual.
            </p>
          </div>
        </div>
      </div>
      </main>
      
      <script nonce="${nonce}" src="${scriptURI}"></script>
      </body>
      </html>`;
  };

  static currentPanel: WelcomePanel | undefined;
  static readonly viewType = "welcomeDeno";

  static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (WelcomePanel.currentPanel) {
      WelcomePanel.currentPanel.#panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      WelcomePanel.viewType,
      "Deno for VSCode",
      column ?? vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri)],
      },
    );
    panel.iconPath = vscode.Uri.joinPath(extensionUri, "deno.png");

    WelcomePanel.currentPanel = new WelcomePanel(panel, extensionUri);
  }

  static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    WelcomePanel.currentPanel = new WelcomePanel(panel, extensionUri);
  }
}

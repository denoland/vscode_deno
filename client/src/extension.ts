// Copyright 2018-2020 the Deno authors. All rights reserved. MIT license.

import { ExtensionContext, workspace } from "vscode";

import {
  Executable,
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
} from "vscode-languageclient";

const SETTINGS_SECTION = "deno";

let client: LanguageClient;

export function activate(context: ExtensionContext) {
  const run: Executable = {
    command: "deno",
    args: ["lsp"],
  };

  const debug: Executable = {
    command: "deno",
    // args: ["lsp", "-L", "debug"],
    args: ["lsp"],
  };

  let serverOptions: ServerOptions = { run, debug };

  let clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: "file", language: "javascript" },
      { scheme: "file", language: "javascriptreact" },
      { scheme: "file", language: "typescript" },
      { scheme: "file", language: "typescriptreact" },
    ],
    initializationOptions: workspace.getConfiguration(SETTINGS_SECTION),
  };

  client = new LanguageClient(
    "deno-language-server",
    "Deno Language Server",
    serverOptions,
    clientOptions,
  );

  context.subscriptions.push(
    workspace.onDidChangeConfiguration((evt) => {
      if (evt.affectsConfiguration(SETTINGS_SECTION)) {
        client.sendNotification(
          "workspace/didChangeConfiguration",
          { settings: null },
        );
      }
    }),
  );

  client.start();
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}

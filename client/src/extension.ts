// Copyright 2018-2020 the Deno authors. All rights reserved. MIT license.

import * as commands from "./commands";
import * as vscode from "vscode";
import {
  Executable,
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
} from "vscode-languageclient";

const EXTENSION_NS = "deno";

let client: LanguageClient;

/** When the extension activates, this function is called with the extension
 * context, and the extension bootstraps itself. */
export function activate(context: vscode.ExtensionContext) {
  const run: Executable = {
    command: "deno",
    args: ["lsp"],
  };

  const debug: Executable = {
    command: "deno",
    // disabled for now, as this gets super chatty during development
    // args: ["lsp", "-L", "debug"],
    args: ["lsp"],
  };

  const serverOptions: ServerOptions = { run, debug };
  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: "file", language: "javascript" },
      { scheme: "file", language: "javascriptreact" },
      { scheme: "file", language: "typescript" },
      { scheme: "file", language: "typescriptreact" },
    ],
    diagnosticCollectionName: "deno",
    initializationOptions: vscode.workspace.getConfiguration(EXTENSION_NS),
  };

  client = new LanguageClient(
    "deno-language-server",
    "Deno Language Server",
    serverOptions,
    clientOptions,
  );

  // Send a notification to the language server when the configuration changes.
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((evt) => {
      if (evt.affectsConfiguration(EXTENSION_NS)) {
        client.sendNotification(
          "workspace/didChangeConfiguration",
          // We actually set this to empty because the language server will
          // call back and get the configuration. There can be issues with the
          // information on the event not being reliable.
          { settings: null },
        );
      }
    }),
  );

  // Register any commands.
  const registerCommand = createRegisterCommand(context);
  registerCommand("status", commands.status);

  client.start();
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}

/** Internal function factory that returns a registerCommand function that is
 * bound to the extension context. */
function createRegisterCommand(
  context: vscode.ExtensionContext,
): (name: string, factory: commands.Factory) => void {
  return function registerCommand(
    name: string,
    factory: (
      context: vscode.ExtensionContext,
      client: LanguageClient,
    ) => commands.Callback,
  ): void {
    const fullName = `${EXTENSION_NS}.${name}`;
    const command = factory(context, client);
    context.subscriptions.push(
      vscode.commands.registerCommand(fullName, command),
    );
  };
}

// Copyright 2018-2020 the Deno authors. All rights reserved. MIT license.

import * as commands from "./commands";
import { DenoTextDocumentContentProvider, SCHEME } from "./content_provider";
import * as vscode from "vscode";
import {
  Executable,
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
} from "vscode-languageclient";

const EXTENSION_NS = "deno";
const EXTENSION_TS_PLUGIN = "typescript-deno-plugin";
const TS_LANGUAGE_FEATURES_EXTENSION = "vscode.typescript-language-features";

interface TsLanguageFeaturesApiV0 {
  configurePlugin(
    pluginId: string,
    configuration: vscode.WorkspaceConfiguration,
  ): void;
}

interface TsLanguageFeatures {
  getAPI(version: 0): TsLanguageFeaturesApiV0 | undefined;
}

/** Assert that the condition is "truthy", otherwise throw. */
function assert(cond: unknown, msg = "Assertion failed."): asserts cond {
  if (!cond) {
    throw new Error(msg);
  }
}

async function getTsApi(): Promise<TsLanguageFeaturesApiV0> {
  const extension: vscode.Extension<TsLanguageFeatures> | undefined = vscode
    .extensions.getExtension(TS_LANGUAGE_FEATURES_EXTENSION);
  const errorMessage =
    "The Deno extension cannot load the built in TypeScript Language Features. Please try restarting Visual Studio Code.";
  assert(extension, errorMessage);
  const languageFeatures = await extension.activate();
  const api = languageFeatures.getAPI(0);
  assert(api, errorMessage);
  return api;
}

let client: LanguageClient;
let tsApi: TsLanguageFeaturesApiV0;

/** When the extension activates, this function is called with the extension
 * context, and the extension bootstraps itself. */
export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
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

  context.subscriptions.push(
    // Send a notification to the language server when the configuration changes
    vscode.workspace.onDidChangeConfiguration((evt) => {
      if (evt.affectsConfiguration(EXTENSION_NS)) {
        client.sendNotification(
          "workspace/didChangeConfiguration",
          // We actually set this to empty because the language server will
          // call back and get the configuration. There can be issues with the
          // information on the event not being reliable.
          { settings: null },
        );
        tsApi.configurePlugin(
          EXTENSION_TS_PLUGIN,
          vscode.workspace.getConfiguration(EXTENSION_NS),
        );
      }
    }),
    // Register a content provider for Deno resolved read-only files.
    vscode.workspace.registerTextDocumentContentProvider(
      SCHEME,
      new DenoTextDocumentContentProvider(client),
    ),
  );

  // Register any commands.
  const registerCommand = createRegisterCommand(context);
  registerCommand("status", commands.status);

  context.subscriptions.push(client.start());
  tsApi = await getTsApi();
  await client.onReady();
  tsApi.configurePlugin(
    EXTENSION_TS_PLUGIN,
    vscode.workspace.getConfiguration(EXTENSION_NS),
  );
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

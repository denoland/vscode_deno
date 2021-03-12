// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.

import * as commands from "./commands";
import {
  EXTENSION_NS,
  EXTENSION_TS_PLUGIN,
  TS_LANGUAGE_FEATURES_EXTENSION,
} from "./constants";
import type { Settings } from "./interfaces";
import { DenoTextDocumentContentProvider, SCHEME } from "./content_provider";
import { DenoDebugConfigurationProvider } from "./debug_config_provider";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import {
  Executable,
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
} from "vscode-languageclient/node";

interface TsLanguageFeaturesApiV0 {
  configurePlugin(
    pluginId: string,
    configuration: Settings,
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

const settingsKeys: Array<keyof Settings> = [
  "codeLens",
  "config",
  "enable",
  "importMap",
  "lint",
  "unstable",
];

function getSettings(): Settings {
  const settings = vscode.workspace.getConfiguration(EXTENSION_NS);
  const result = Object.create(null);
  for (const key of settingsKeys) {
    const value = settings.inspect(key);
    assert(value);
    result[key] = value.workspaceValue ?? value.globalValue ??
      value.defaultValue;
  }
  return result;
}

let client: LanguageClient;
let tsApi: TsLanguageFeaturesApiV0;
let statusBarItem: vscode.StatusBarItem;

/** When the extension activates, this function is called with the extension
 * context, and the extension bootstraps itself. */
export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  const command =
    vscode.workspace.getConfiguration("deno").get<string>("path") ||
    await getDefaultDenoCommand();
  const run: Executable = {
    command,
    args: ["lsp"],
    // deno-lint-ignore no-undef
    options: { env: { ...process.env, "NO_COLOR": true } },
  };

  const debug: Executable = {
    command,
    // disabled for now, as this gets super chatty during development
    // args: ["lsp", "-L", "debug"],
    args: ["lsp"],
    // deno-lint-ignore no-undef
    options: { env: { ...process.env, "NO_COLOR": true } },
  };

  const serverOptions: ServerOptions = { run, debug };
  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: "file", language: "javascript" },
      { scheme: "file", language: "javascriptreact" },
      { scheme: "file", language: "typescript" },
      { scheme: "file", language: "typescriptreact" },
      { scheme: "deno", language: "javascript" },
      { scheme: "deno", language: "javascriptreact" },
      { scheme: "deno", language: "typescript" },
      { scheme: "deno", language: "typescriptreact" },
    ],
    diagnosticCollectionName: "deno",
    initializationOptions: getSettings(),
  };

  client = new LanguageClient(
    "deno-language-server",
    "Deno Language Server",
    serverOptions,
    clientOptions,
  );

  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    0,
  );
  context.subscriptions.push(statusBarItem);

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
          getSettings(),
        );
      }
    }),
    // Register a content provider for Deno resolved read-only files.
    vscode.workspace.registerTextDocumentContentProvider(
      SCHEME,
      new DenoTextDocumentContentProvider(client),
    ),
  );

  context.subscriptions.push(
    vscode.debug.registerDebugConfigurationProvider(
      "deno",
      new DenoDebugConfigurationProvider(getSettings),
    ),
  );

  // Register any commands.
  const registerCommand = createRegisterCommand(context);
  registerCommand("cache", commands.cache);
  registerCommand("initializeWorkspace", commands.initializeWorkspace);
  registerCommand("showReferences", commands.showReferences);
  registerCommand("status", commands.status);
  registerCommand("welcome", commands.welcome);

  context.subscriptions.push(client.start());
  tsApi = await getTsApi();
  await client.onReady();
  vscode.commands.executeCommand("setContext", "deno:lspReady", true);
  const serverVersion =
    (client.initializeResult?.serverInfo?.version ?? "").split(" ")[0];
  statusBarItem.text = `Deno ${serverVersion}`;
  statusBarItem.tooltip = client.initializeResult?.serverInfo?.version;
  statusBarItem.show();
  tsApi.configurePlugin(
    EXTENSION_TS_PLUGIN,
    getSettings(),
  );

  showWelcomePage(context);
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop().then(() => {
    vscode.commands.executeCommand("setContext", "deno:lspReady", false);
  });
}

function showWelcomePage(context: vscode.ExtensionContext) {
  const welcomeShown = context.globalState.get<boolean>("deno.welcomeShown") ??
    false;

  if (!welcomeShown) {
    commands.welcome(context, client)();
    context.globalState.update("deno.welcomeShown", true);
  }
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

function getDefaultDenoCommand() {
  switch (os.platform()) {
    case "win32":
      return getDenoWindowsPath();
    default:
      return Promise.resolve("deno");
  }

  async function getDenoWindowsPath() {
    // Adapted from https://github.com/npm/node-which/blob/master/which.js
    // Within vscode it will do `require("child_process").spawn("deno")`,
    // which will prioritize "deno.exe" on the path instead of a possible
    // higher precedence non-exe executable. This is a problem because, for
    // example, version managers may have a `deno.bat` shim on the path. To
    // ensure the resolution of the `deno` command matches what occurs on the
    // command line, attempt to manually resolve the file path (issue #361).
    const denoCmd = "deno";
    // deno-lint-ignore no-undef
    const pathExtValue = process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM";
    // deno-lint-ignore no-undef
    const pathValue = process.env.PATH ?? "";
    const pathExtItems = splitEnvValue(pathExtValue);
    const pathFolderPaths = splitEnvValue(pathValue);

    for (const pathFolderPath of pathFolderPaths) {
      for (const pathExtItem of pathExtItems) {
        const cmdFilePath = path.join(pathFolderPath, denoCmd + pathExtItem);
        if (await fileExists(cmdFilePath)) {
          return cmdFilePath;
        }
      }
    }

    // nothing found; return back command
    return denoCmd;

    function splitEnvValue(value: string) {
      return value
        .split(";")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    }
  }

  function fileExists(executableFilePath: string) {
    return new Promise((resolve) => {
      fs.stat(executableFilePath, (err, stat) => {
        resolve(err == null && stat.isFile());
      });
    }).catch(() => {
      // ignore all errors
      return false;
    });
  }
}

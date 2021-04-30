// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.

import * as commands from "./commands";
import {
  ENABLEMENT_FLAG,
  EXTENSION_NS,
  EXTENSION_TS_PLUGIN,
  TS_LANGUAGE_FEATURES_EXTENSION,
} from "./constants";
import type {
  DenoExtensionContext,
  Settings,
  TsLanguageFeaturesApiV0,
} from "./interfaces";
import { DenoTextDocumentContentProvider, SCHEME } from "./content_provider";
import { DenoDebugConfigurationProvider } from "./debug_config_provider";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as semver from "semver";
import * as vscode from "vscode";
import type { Executable } from "vscode-languageclient/node";

const SERVER_SEMVER = ">=1.9.0";

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
  "internalDebug",
  "lint",
  "suggest",
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

const extensionContext = {} as DenoExtensionContext;

/** When the extension activates, this function is called with the extension
 * context, and the extension bootstraps itself. */
export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  const command = await getCommand();
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

  extensionContext.serverOptions = { run, debug };
  extensionContext.clientOptions = {
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

  extensionContext.statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    0,
  );
  context.subscriptions.push(extensionContext.statusBarItem);

  context.subscriptions.push(
    // Send a notification to the language server when the configuration changes
    vscode.workspace.onDidChangeConfiguration((evt) => {
      if (evt.affectsConfiguration(EXTENSION_NS)) {
        extensionContext.client.sendNotification(
          "workspace/didChangeConfiguration",
          // We actually set this to empty because the language server will
          // call back and get the configuration. There can be issues with the
          // information on the event not being reliable.
          { settings: null },
        );
        extensionContext.tsApi.configurePlugin(
          EXTENSION_TS_PLUGIN,
          getSettings(),
        );
      }
    }),
    // Register a content provider for Deno resolved read-only files.
    vscode.workspace.registerTextDocumentContentProvider(
      SCHEME,
      new DenoTextDocumentContentProvider(extensionContext),
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
  registerCommand("restart", commands.startLanguageServer);
  registerCommand("reloadImportRegistries", commands.reloadImportRegistries);
  registerCommand("showReferences", commands.showReferences);
  registerCommand("status", commands.status);
  registerCommand("welcome", commands.welcome);

  extensionContext.tsApi = await getTsApi();

  await commands.startLanguageServer(context, extensionContext)();

  extensionContext.tsApi.configurePlugin(
    EXTENSION_TS_PLUGIN,
    getSettings(),
  );

  if (
    semver.valid(extensionContext.serverVersion) &&
    !semver.satisfies(extensionContext.serverVersion, SERVER_SEMVER)
  ) {
    notifyServerSemver(extensionContext.serverVersion);
  } else {
    showWelcomePage(context);
  }
}

export function deactivate(): Thenable<void> | undefined {
  if (!extensionContext.client) {
    return undefined;
  }
  return extensionContext.client.stop().then(() => {
    extensionContext.statusBarItem.hide();
    vscode.commands.executeCommand("setContext", ENABLEMENT_FLAG, false);
  });
}

function notifyServerSemver(serverVersion: string) {
  return vscode.window.showWarningMessage(
    `The version of Deno language server ("${serverVersion}") does not meet the requirements of the extension ("${SERVER_SEMVER}"). Please update Deno and restart.`,
    "OK",
  );
}

function showWelcomePage(context: vscode.ExtensionContext) {
  const welcomeShown = context.globalState.get<boolean>("deno.welcomeShown") ??
    false;

  if (!welcomeShown) {
    commands.welcome(context, extensionContext)();
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
      extensionContext: DenoExtensionContext,
    ) => commands.Callback,
  ): void {
    const fullName = `${EXTENSION_NS}.${name}`;
    const command = factory(context, extensionContext);
    context.subscriptions.push(
      vscode.commands.registerCommand(fullName, command),
    );
  };
}

async function getCommand() {
  let command = vscode.workspace.getConfiguration("deno").get<string>("path");
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const defaultCommand = await getDefaultDenoCommand();
  if (!command || !workspaceFolders) {
    command = command ?? defaultCommand;
  } else if (!path.isAbsolute(command)) {
    // if sent a relative path, iterate over workspace folders to try and resolve.
    const list = [];
    for (const workspace of workspaceFolders) {
      const dir = path.resolve(workspace.uri.path, command);
      try {
        const stat = await fs.promises.stat(dir);
        if (stat.isFile()) {
          list.push(dir);
        }
      } catch {
        // we simply don't push onto the array if we encounter an error
      }
    }
    command = list.shift() ?? defaultCommand;
  }
  return command;
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

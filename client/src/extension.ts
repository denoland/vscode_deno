// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.

import * as commands from "./commands";
import {
  ENABLEMENT_FLAG,
  EXTENSION_NS,
  EXTENSION_TS_PLUGIN,
  TS_LANGUAGE_FEATURES_EXTENSION,
} from "./constants";
import { DenoTextDocumentContentProvider, SCHEME } from "./content_provider";
import { DenoDebugConfigurationProvider } from "./debug_config_provider";
import { registryState } from "./lsp_extensions";
import { createRegistryStateHandler } from "./notification_handlers";
import { activateTaskProvider } from "./tasks";
import type {
  DenoExtensionContext,
  Settings,
  TsLanguageFeaturesApiV0,
} from "./types";
import { assert, getDenoCommand } from "./util";

import * as path from "path";
import * as semver from "semver";
import * as vscode from "vscode";
import type { Executable } from "vscode-languageclient/node";

/** The minimum version of Deno that this extension is designed to support. */
const SERVER_SEMVER = ">=1.10.3";

/** The language IDs we care about. */
const LANGUAGES = [
  "typescript",
  "javascript",
  "typescriptreact",
  "javascriptreact",
];

interface TsLanguageFeatures {
  getAPI(version: 0): TsLanguageFeaturesApiV0 | undefined;
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

/** These are keys of settings that have a scope of window or machine. */
const workspaceSettingsKeys: Array<keyof Settings> = [
  "codeLens",
  "config",
  "importMap",
  "internalDebug",
  "lint",
  "suggest",
  "unstable",
];

/** These are keys of settings that can apply to an individual resource, like
 * a file or folder. */
const resourceSettingsKeys: Array<keyof Settings> = [
  "enable",
  "codeLens",
];

/** Convert a workspace configuration to `Settings` for a workspace. */
function configToWorkspaceSettings(
  config: vscode.WorkspaceConfiguration,
): Settings {
  const workspaceSettings = Object.create(null);
  for (const key of workspaceSettingsKeys) {
    const value = config.inspect(key);
    assert(value);
    workspaceSettings[key] = value.workspaceLanguageValue ??
      value.workspaceValue ??
      value.globalValue ??
      value.defaultValue;
  }
  for (const key of resourceSettingsKeys) {
    const value = config.inspect(key);
    assert(value);
    workspaceSettings[key] = value.workspaceLanguageValue ??
      value.workspaceValue ??
      value.globalValue ??
      value.defaultValue;
  }
  return workspaceSettings;
}

/** Convert a workspace configuration to settings that apply to a resource. */
function configToResourceSettings(
  config: vscode.WorkspaceConfiguration,
): Partial<Settings> {
  const resourceSettings = Object.create(null);
  for (const key of resourceSettingsKeys) {
    const value = config.inspect(key);
    assert(value);
    resourceSettings[key] = value.workspaceFolderLanguageValue ??
      value.workspaceFolderValue ?? value.workspaceLanguageValue ??
      value.workspaceValue ??
      value.globalValue ??
      value.defaultValue;
  }
  return resourceSettings;
}

function getWorkspaceSettings(): Settings {
  const config = vscode.workspace.getConfiguration(EXTENSION_NS);
  return configToWorkspaceSettings(config);
}

/** Update the typescript-deno-plugin with settings. */
function configurePlugin() {
  const { documentSettings: documents, tsApi, workspaceSettings: workspace } =
    extensionContext;
  tsApi.configurePlugin(EXTENSION_TS_PLUGIN, { workspace, documents });
}

function handleConfigurationChange(event: vscode.ConfigurationChangeEvent) {
  if (event.affectsConfiguration(EXTENSION_NS)) {
    extensionContext.client.sendNotification(
      "workspace/didChangeConfiguration",
      // We actually set this to empty because the language server will
      // call back and get the configuration. There can be issues with the
      // information on the event not being reliable.
      { settings: null },
    );
    extensionContext.workspaceSettings = getWorkspaceSettings();
    for (
      const [key, { scope }] of Object.entries(
        extensionContext.documentSettings,
      )
    ) {
      extensionContext.documentSettings[key] = {
        scope,
        settings: configToResourceSettings(
          vscode.workspace.getConfiguration(EXTENSION_NS, scope),
        ),
      };
    }
    configurePlugin();
  }
}

function handleDocumentOpen(...documents: vscode.TextDocument[]) {
  let didChange = false;
  for (const doc of documents) {
    if (!LANGUAGES.includes(doc.languageId)) {
      continue;
    }
    const { languageId, uri } = doc;
    extensionContext.documentSettings[path.normalize(doc.uri.fsPath)] = {
      scope: { languageId, uri },
      settings: configToResourceSettings(
        vscode.workspace.getConfiguration(EXTENSION_NS, { languageId, uri }),
      ),
    };
    didChange = true;
  }
  if (didChange) {
    configurePlugin();
  }
}

const extensionContext = {} as DenoExtensionContext;

/** When the extension activates, this function is called with the extension
 * context, and the extension bootstraps itself. */
export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  const command = await getDenoCommand();
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
      { scheme: "file", language: "json" },
      { scheme: "file", language: "jsonc" },
      { scheme: "file", language: "markdown" },
    ],
    diagnosticCollectionName: "deno",
    initializationOptions: getWorkspaceSettings(),
  };

  // When a document opens, the language server will query the client to
  // determine the specific configuration of a resource, we need to ensure the
  // the builtin TypeScript language service has the same "view" of the world,
  // so when Deno is enabled, we need to disable the built in language service,
  // but this is determined on a file by file basis.
  vscode.workspace.onDidOpenTextDocument(
    handleDocumentOpen,
    extensionContext,
    context.subscriptions,
  );

  // Send a notification to the language server when the configuration changes
  // as well as update the TypeScript language service plugin
  vscode.workspace.onDidChangeConfiguration(
    handleConfigurationChange,
    extensionContext,
    context.subscriptions,
  );

  extensionContext.statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    0,
  );
  context.subscriptions.push(extensionContext.statusBarItem);

  // Register a content provider for Deno resolved read-only files.
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      SCHEME,
      new DenoTextDocumentContentProvider(extensionContext),
    ),
  );

  context.subscriptions.push(
    vscode.debug.registerDebugConfigurationProvider(
      "deno",
      new DenoDebugConfigurationProvider(getWorkspaceSettings),
    ),
  );

  // Activate the task provider.
  context.subscriptions.push(activateTaskProvider());

  // Register any commands.
  const registerCommand = createRegisterCommand(context);
  registerCommand("cache", commands.cache);
  registerCommand("initializeWorkspace", commands.initializeWorkspace);
  registerCommand("restart", commands.startLanguageServer);
  registerCommand("reloadImportRegistries", commands.reloadImportRegistries);
  registerCommand("showReferences", commands.showReferences);
  registerCommand("status", commands.status);
  registerCommand("test", commands.test);
  registerCommand("welcome", commands.welcome);

  extensionContext.tsApi = await getTsApi();

  await commands.startLanguageServer(context, extensionContext)();

  context.subscriptions.push(
    extensionContext.client.onNotification(
      registryState,
      createRegistryStateHandler(),
    ),
  );

  extensionContext.documentSettings = {};
  extensionContext.workspaceSettings = getWorkspaceSettings();
  configurePlugin();
  // when we activate, it might have been because a document was opened that
  // activated us, which we need to grab the config for and send it over to the
  // plugin
  handleDocumentOpen(...vscode.workspace.textDocuments);

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

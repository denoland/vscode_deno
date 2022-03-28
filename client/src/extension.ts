// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.

import * as commands from "./commands";
import { ENABLE_PATHS, ENABLEMENT_FLAG, EXTENSION_NS } from "./constants";
import { DenoTextDocumentContentProvider, SCHEME } from "./content_provider";
import { DenoDebugConfigurationProvider } from "./debug_config_provider";
import { setupCheckConfig } from "./enable";
import type { EnabledPaths } from "./shared_types";
import { DenoStatusBar } from "./status_bar";
import { activateTaskProvider } from "./tasks";
import { getTsApi } from "./ts_api";
import type { DenoExtensionContext, Settings } from "./types";
import { assert } from "./util";

import * as vscode from "vscode";

/** The language IDs we care about. */
const LANGUAGES = [
  "typescript",
  "javascript",
  "typescriptreact",
  "javascriptreact",
];

/** These are keys of settings that have a scope of window or machine. */
const workspaceSettingsKeys: Array<keyof Settings> = [
  "cache",
  "certificateStores",
  "codeLens",
  "config",
  "enable",
  "enablePaths",
  "importMap",
  "internalDebug",
  "lint",
  "path",
  "suggest",
  "tlsCertificate",
  "unsafelyIgnoreCertificateErrors",
  "unstable",
];

/** These are keys of settings that can apply to an individual resource, like
 * a file or folder. */
const resourceSettingsKeys: Array<keyof Settings> = [
  "codeLens",
  "enable",
  "enablePaths",
];

/** Convert a workspace configuration to `Settings` for a workspace. */
function configToWorkspaceSettings(
  config: vscode.WorkspaceConfiguration,
): Settings {
  const workspaceSettings = Object.create(null);
  for (const key of workspaceSettingsKeys) {
    workspaceSettings[key] = config.get(key);
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

function getEnabledPaths(): EnabledPaths[] {
  const items = [] as EnabledPaths[];
  if (!vscode.workspace.workspaceFolders) {
    return items;
  }
  for (const workspaceFolder of vscode.workspace.workspaceFolders) {
    const config = vscode.workspace.getConfiguration(
      EXTENSION_NS,
      workspaceFolder,
    );
    const enabledPaths = config.get<string[]>(ENABLE_PATHS);
    if (!enabledPaths || !enabledPaths.length) {
      continue;
    }
    const paths = enabledPaths.map((folder) =>
      vscode.Uri.joinPath(workspaceFolder.uri, folder).fsPath
    );
    items.push({
      workspace: workspaceFolder.uri.fsPath,
      paths,
    });
  }
  return items;
}

function getWorkspaceSettings(): Settings {
  const config = vscode.workspace.getConfiguration(EXTENSION_NS);
  return configToWorkspaceSettings(config);
}

function handleConfigurationChange(event: vscode.ConfigurationChangeEvent) {
  if (event.affectsConfiguration(EXTENSION_NS)) {
    extensionContext.client?.sendNotification(
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
    extensionContext.enabledPaths = getEnabledPaths();
    extensionContext.tsApi.refresh();
    extensionContext.statusBar.refresh(extensionContext);

    // restart when "deno.path" changes
    if (event.affectsConfiguration("deno.path")) {
      vscode.commands.executeCommand("deno.restart");
    }
  }
}

function handleChangeWorkspaceFolders() {
  extensionContext.enabledPaths = getEnabledPaths();
  extensionContext.tsApi.refresh();
}

function handleDocumentOpen(...documents: vscode.TextDocument[]) {
  let didChange = false;
  for (const doc of documents) {
    if (!LANGUAGES.includes(doc.languageId)) {
      continue;
    }
    const { languageId, uri } = doc;
    extensionContext.documentSettings[doc.uri.fsPath] = {
      scope: { languageId, uri },
      settings: configToResourceSettings(
        vscode.workspace.getConfiguration(EXTENSION_NS, { languageId, uri }),
      ),
    };
    didChange = true;
  }
  if (didChange) {
    extensionContext.tsApi.refresh();
  }
}

const extensionContext = {} as DenoExtensionContext;

/** When the extension activates, this function is called with the extension
 * context, and the extension bootstraps itself. */
export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
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

  // When a workspace folder is opened, the updates or changes to the workspace
  // folders need to be sent to the TypeScript language service plugin
  vscode.workspace.onDidChangeWorkspaceFolders(
    handleChangeWorkspaceFolders,
    extensionContext,
    context.subscriptions,
  );

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

  extensionContext.statusBar = new DenoStatusBar();
  context.subscriptions.push(extensionContext.statusBar);

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

  extensionContext.tsApi = getTsApi(() => ({
    documents: extensionContext.documentSettings,
    enabledPaths: extensionContext.enabledPaths,
    workspace: extensionContext.workspaceSettings,
  }));

  extensionContext.documentSettings = {};
  extensionContext.enabledPaths = getEnabledPaths();
  extensionContext.workspaceSettings = getWorkspaceSettings();

  // setup detection of enabling Deno detection
  context.subscriptions.push(await setupCheckConfig());

  // when we activate, it might have been because a document was opened that
  // activated us, which we need to grab the config for and send it over to the
  // plugin
  handleDocumentOpen(...vscode.workspace.textDocuments);

  await commands.startLanguageServer(context, extensionContext)();
}

export function deactivate(): Thenable<void> | undefined {
  if (!extensionContext.client) {
    return undefined;
  }

  const client = extensionContext.client;
  extensionContext.client = undefined;
  extensionContext.statusBar.refresh(extensionContext);
  vscode.commands.executeCommand("setContext", ENABLEMENT_FLAG, false);
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

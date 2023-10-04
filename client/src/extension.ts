// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

import * as commands from "./commands";
import {
  DISABLE_PATHS,
  ENABLE_PATHS,
  ENABLEMENT_FLAG,
  EXTENSION_NS,
  LANGUAGE_CLIENT_NAME,
} from "./constants";
import { DenoTextDocumentContentProvider, SCHEME } from "./content_provider";
import { DenoDebugConfigurationProvider } from "./debug_config_provider";
import { setupCheckConfig } from "./enable";
import * as semver from "semver";
import type { LanguageSettings, PathFilter } from "./shared_types";
import { DenoStatusBar } from "./status_bar";
import { activateTaskProvider } from "./tasks";
import { getTsApi } from "./ts_api";
import type { DenoExtensionContext, Settings } from "./types";
import { assert } from "./util";
import * as util from "util";

import * as vscode from "vscode";
import { registerSidebar } from "./tasks_sidebar";

/** The language IDs we care about. */
const LANGUAGES = [
  "typescript",
  "javascript",
  "typescriptreact",
  "javascriptreact",
];

/** These are keys of settings that have a scope of window or machine. */
const languageSettingsKeys: Array<keyof LanguageSettings> = [
  "inlayHints",
  "preferences",
  "suggest",
  "updateImportsOnFileMove",
];

/** These are keys of settings that have a scope of window or machine. */
const workspaceSettingsKeys: Array<keyof Settings> = [
  "cache",
  "cacheOnSave",
  "certificateStores",
  "codeLens",
  "config",
  "documentPreloadLimit",
  "maxTsServerMemory",
  "enable",
  "disablePaths",
  "enablePaths",
  "importMap",
  "inlayHints",
  "internalDebug",
  "lint",
  "path",
  "suggest",
  "testing",
  "tlsCertificate",
  "unsafelyIgnoreCertificateErrors",
  "unstable",
];

/** These are keys of settings that can apply to an individual resource, like
 * a file or folder. */
const resourceSettingsKeys: Array<keyof Settings> = [
  "codeLens",
  "enable",
  "disablePaths",
  "enablePaths",
];

/** Convert a workspace configuration to settings that apply to a resource. */
function configToResourceSettings(
  config: vscode.WorkspaceConfiguration,
): Partial<Settings> {
  const resourceSettings = Object.create(null);
  for (const key of resourceSettingsKeys) {
    const value = config.inspect(key);
    assert(value);
    resourceSettings[key] = value.workspaceFolderLanguageValue ??
      value.workspaceFolderValue ??
      value.workspaceLanguageValue ??
      value.workspaceValue ??
      value.globalValue ??
      value.defaultValue;
  }
  return resourceSettings;
}

function getPathFilters(): PathFilter[] {
  const items = [] as PathFilter[];
  if (!vscode.workspace.workspaceFolders) {
    return items;
  }
  for (const workspaceFolder of vscode.workspace.workspaceFolders) {
    const config = vscode.workspace.getConfiguration(
      EXTENSION_NS,
      workspaceFolder,
    );
    const disabled_ = config.get<string[]>(DISABLE_PATHS) ?? [];
    const disabled = disabled_.map((p) =>
      vscode.Uri.joinPath(workspaceFolder.uri, p).fsPath
    );
    const enabled_ = config.get<string[]>(ENABLE_PATHS);
    // We convert `enablePaths: []` to `enablePaths: null` for now.
    // See https://github.com/denoland/vscode_deno/issues/908.
    const enabled = enabled_?.length
      ? enabled_.map((p) => vscode.Uri.joinPath(workspaceFolder.uri, p).fsPath)
      : null;
    if (disabled.length === 0 && enabled == null) {
      continue;
    }
    items.push({
      workspace: workspaceFolder.uri.fsPath,
      disabled,
      enabled,
    });
  }
  return items;
}

function getWorkspaceSettings(): Settings {
  const config = vscode.workspace.getConfiguration(EXTENSION_NS);
  const workspaceSettings = Object.create(null);
  for (const key of workspaceSettingsKeys) {
    workspaceSettings[key] = config.get(key);
    // TODO(nayeemrmn): Deno LSP versions < 1.37.0 require `deno.enable` to be
    // non-null. Eventually remove this.
    if (
      semver.lt(extensionContext.serverInfo?.version ?? "1.0.0", "1.37.0-rc") &&
      key == "enable"
    ) {
      workspaceSettings[key] ??= false;
    }
  }
  workspaceSettings.javascript = Object.create(null);
  workspaceSettings.typescript = Object.create(null);
  const jsConfig = vscode.workspace.getConfiguration("javascript");
  const tsConfig = vscode.workspace.getConfiguration("typescript");
  for (const key of languageSettingsKeys) {
    workspaceSettings.javascript[key] = jsConfig.get(key);
    workspaceSettings.typescript[key] = tsConfig.get(key);
  }
  return workspaceSettings;
}

function handleConfigurationChange(event: vscode.ConfigurationChangeEvent) {
  if (
    [EXTENSION_NS, "javascript", "typescript"].some((s) =>
      event.affectsConfiguration(s)
    )
  ) {
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
    extensionContext.pathFilters = getPathFilters();
    extensionContext.tsApi.refresh();
    extensionContext.statusBar.refresh(extensionContext);

    // restart when certain config changes
    if (
      event.affectsConfiguration("deno.enable") ||
      event.affectsConfiguration("deno.disablePaths") ||
      event.affectsConfiguration("deno.enablePaths") ||
      event.affectsConfiguration("deno.path") ||
      event.affectsConfiguration("deno.maxTsServerMemory")
    ) {
      vscode.commands.executeCommand("deno.client.restart");
    }
  }
}

function handleChangeWorkspaceFolders() {
  extensionContext.pathFilters = getPathFilters();
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

// TODO(nayeemrmn): Deno LSP versions > 1.37.0 handle `cacheOnSave`
// server-side. Eventually remove this handler.
function handleTextDocumentSave(doc: vscode.TextDocument) {
  if (!LANGUAGES.includes(doc.languageId)) {
    return;
  }
  if (semver.gt(extensionContext.serverInfo?.version ?? "1.0.0", "1.37.0")) {
    return;
  }
  if (extensionContext.workspaceSettings.cacheOnSave) {
    const diagnostics = vscode.languages.getDiagnostics(doc.uri);
    if (
      !diagnostics.some(
        (it) => it.code === "no-cache" || it.code === "no-cache-npm",
      )
    ) {
      return;
    }

    vscode.commands.executeCommand(
      "deno.cache",
      [doc.uri.toString()],
      doc.uri.toString(),
    );
  }
}

export function log(...msgs: unknown[]) {
  extensionContext.outputChannel.appendLine(
    msgs.map((m) => typeof m === "string" ? m : util.inspect(m)).join(" "),
  );
}

const extensionContext = {} as DenoExtensionContext;

/** When the extension activates, this function is called with the extension
 * context, and the extension bootstraps itself. */
export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  extensionContext.outputChannel = extensionContext.outputChannel ??
    vscode.window.createOutputChannel(LANGUAGE_CLIENT_NAME);
  const p2cMap = new Map<string, string>();
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
      { notebook: "*", language: "javascript" },
      { notebook: "*", language: "javascriptreact" },
      { notebook: "*", language: "typescript" },
      { notebook: "*", language: "typescriptreact" },
    ],
    uriConverters: {
      code2Protocol: (uri) => {
        if (uri.scheme == "vscode-notebook-cell") {
          const string = uri.with({
            scheme: "deno-notebook-cell",
          }).toString();
          p2cMap.set(string, uri.toString());
          return string;
        }
        return uri.toString();
      },
      protocol2Code: (s) => {
        const maybeMapped = p2cMap.get(s);
        if (maybeMapped) {
          return vscode.Uri.parse(maybeMapped);
        }
        return vscode.Uri.parse(s);
      },
    },
    diagnosticCollectionName: "deno",
    initializationOptions: () => {
      const options: Settings & { enableBuiltinCommands?: true; } =
        getWorkspaceSettings();
      options.enableBuiltinCommands = true;
      return options;
    },
    markdown: {
      isTrusted: true,
    },
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

  vscode.workspace.onDidSaveTextDocument(
    handleTextDocumentSave,
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
      new DenoDebugConfigurationProvider(extensionContext),
    ),
  );

  // Activate the task provider.
  context.subscriptions.push(activateTaskProvider(extensionContext));

  context.subscriptions.push(await setupCheckConfig(extensionContext));

  extensionContext.tsApi = getTsApi(() => ({
    documents: extensionContext.documentSettings,
    pathFilters: extensionContext.pathFilters,
    hasDenoConfig: extensionContext.hasDenoConfig,
    workspace: extensionContext.workspaceSettings,
  }));

  extensionContext.documentSettings = {};
  extensionContext.pathFilters = getPathFilters();
  extensionContext.workspaceSettings = getWorkspaceSettings();

  // when we activate, it might have been because a document was opened that
  // activated us, which we need to grab the config for and send it over to the
  // plugin
  handleDocumentOpen(...vscode.workspace.textDocuments);

  await commands.startLanguageServer(context, extensionContext)();
  // TODO(nayeemrmn): Deno LSP versions < 1.37.0 has different compat logic.
  // We restart here if it's detected. Eventually remove this.
  if (!semver.lt(extensionContext.serverInfo!.version, "1.37.0-rc")) {
    extensionContext.workspaceSettings = getWorkspaceSettings();
    await commands.startLanguageServer(context, extensionContext)();
  }

  const treeDataProvider = registerSidebar(extensionContext, context.subscriptions)!;
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("deno.defaultTaskCommand")) {
      treeDataProvider.refresh();
    }
  }));
  context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(event => {
    if (event.uri.fsPath.match(/\/deno\.jsonc?$/)) {
      treeDataProvider.refresh();
    }
  }));
  context.subscriptions.push(vscode.workspace.onDidRenameFiles(event => {
    if (event.files.some(({ oldUri: uri }) => uri.fsPath.match(/\/deno\.jsonc?$/))) {
      treeDataProvider.refresh();
    }
  }));

  // Register any commands.
  const registerCommand = createRegisterCommand(context);
  const builtinCommands = await vscode.commands.getCommands();
  // TODO(nayeemrmn): As of Deno 1.37.0, the `deno.cache` command is implemented
  // on the server. Remove this eventually.
  if (!builtinCommands.includes("deno.cache")) {
    registerCommand("deno.cache", commands.cache);
  }
  // TODO(nayeemrmn): Change the LSP's invocations of this to
  // `deno.client.showReferences`. Remove this one eventually.
  if (!builtinCommands.includes("deno.showReferences")) {
    registerCommand("deno.showReferences", commands.showReferences);
  }
  registerCommand("deno.client.showReferences", commands.showReferences);
  // TODO(nayeemrmn): Change the LSP's invocations of this to
  // `deno.client.test`. Remove this one eventually.
  if (!builtinCommands.includes("deno.test")) {
    registerCommand("deno.test", commands.test);
  }
  // TODO(nayeemrmn): Move server-side as `deno.reloadImportRegistries`.
  registerCommand(
    "deno.client.reloadImportRegistries",
    commands.reloadImportRegistries,
  );
  registerCommand("deno.client.test", commands.test);
  registerCommand(
    "deno.client.cacheActiveDocument",
    commands.cacheActiveDocument,
  );
  registerCommand(
    "deno.client.initializeWorkspace",
    commands.initializeWorkspace,
  );
  registerCommand("deno.client.restart", commands.startLanguageServer);
  registerCommand("deno.client.status", commands.status);
  registerCommand("deno.client.welcome", commands.welcome);
  registerCommand("deno.client.openOutput", commands.openOutput);

  registerCommand("deno.tasks.refresh", commands.refreshTasks.bind(null, treeDataProvider));
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
    const command = factory(context, extensionContext);
    context.subscriptions.push(
      vscode.commands.registerCommand(name, command),
    );
  };
}

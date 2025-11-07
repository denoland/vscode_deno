// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

import * as commands from "./commands";
import {
  ENABLEMENT_FLAG,
  EXTENSION_NS,
  LANGUAGE_CLIENT_NAME,
} from "./constants";
import { DenoTextDocumentContentProvider, SCHEME } from "./content_provider";
import { DenoDebugConfigurationProvider } from "./debug_config_provider";
import { refreshEnableSettings } from "./enable";
import { DenoStatusBar } from "./status_bar";
import { activateTaskProvider } from "./tasks";
import { getTsApi } from "./ts_api";
import type { DenoExtensionContext } from "./types";
import * as util from "util";

import * as vscode from "vscode";
import { registerSidebar } from "./tasks_sidebar";
import { getDenoInfoJson } from "./util";

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
    extensionContext.maxTsServerMemory =
      vscode.workspace.getConfiguration(EXTENSION_NS).get(
        "maxTsServerMemory",
      ) ?? null;
    refreshEnableSettings(extensionContext);
    extensionContext.tsApi.refresh();
    extensionContext.statusBar.refresh(extensionContext);

    // restart when certain config changes
    if (
      event.affectsConfiguration("deno.enable") ||
      event.affectsConfiguration("deno.disablePaths") ||
      event.affectsConfiguration("deno.enablePaths") ||
      event.affectsConfiguration("deno.env") ||
      event.affectsConfiguration("deno.envFile") ||
      event.affectsConfiguration("deno.future") ||
      event.affectsConfiguration("deno.semanticHighlighting.enabled") ||
      event.affectsConfiguration("deno.internalInspect") ||
      event.affectsConfiguration("deno.logFile") ||
      event.affectsConfiguration("deno.path") ||
      event.affectsConfiguration("deno.maxTsServerMemory")
    ) {
      vscode.commands.executeCommand("deno.client.restart");
    }
  }
}

function handleChangeWorkspaceFolders() {
  refreshEnableSettings(extensionContext);
  extensionContext.tsApi.refresh();
}

export function log(...msgs: unknown[]) {
  extensionContext.outputChannel.appendLine(
    msgs.map((m) =>
      typeof m === "string" ? m : util.inspect(m, { depth: Infinity })
    ).join(" "),
  );
}

const extensionContext = {} as DenoExtensionContext;

/** When the extension activates, this function is called with the extension
 * context, and the extension bootstraps itself. */
export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  extensionContext.outputChannel = extensionContext.outputChannel ??
    vscode.window.createOutputChannel(LANGUAGE_CLIENT_NAME, { log: true });
  extensionContext.denoInfoJson = await getDenoInfoJson(
    extensionContext.outputChannel,
  );
  const p2cMap = new Map<string, string>();
  extensionContext.clientOptions = {
    documentSelector: [
      { scheme: "file", language: "javascript" },
      { scheme: "file", language: "javascriptreact" },
      { scheme: "file", language: "typescript" },
      { scheme: "file", language: "typescriptreact" },
      { scheme: "file", language: "json" },
      { scheme: "file", language: "jsonc" },
      { scheme: "file", language: "markdown" },
      { scheme: "file", language: "html" },
      { scheme: "file", language: "css" },
      { scheme: "file", language: "scss" },
      { scheme: "file", language: "sass" },
      { scheme: "file", language: "less" },
      { scheme: "file", language: "yaml" },
      { scheme: "file", language: "sql" },
      { scheme: "file", language: "svelte" },
      { scheme: "file", language: "vue" },
      { scheme: "file", language: "astro" },
      { scheme: "file", language: "vento" },
      { scheme: "file", language: "nunjucks" },
      { scheme: "untitled", language: "javascript" },
      { scheme: "untitled", language: "javascriptreact" },
      { scheme: "untitled", language: "typescript" },
      { scheme: "untitled", language: "typescriptreact" },
      { scheme: "untitled", language: "json" },
      { scheme: "untitled", language: "jsonc" },
      { scheme: "untitled", language: "markdown" },
      { scheme: "untitled", language: "html" },
      { scheme: "untitled", language: "css" },
      { scheme: "untitled", language: "scss" },
      { scheme: "untitled", language: "sass" },
      { scheme: "untitled", language: "less" },
      { scheme: "untitled", language: "yaml" },
      { scheme: "untitled", language: "sql" },
      { scheme: "untitled", language: "svelte" },
      { scheme: "untitled", language: "vue" },
      { scheme: "untitled", language: "astro" },
      { scheme: "untitled", language: "vento" },
      { scheme: "untitled", language: "nunjucks" },
      { scheme: "deno", language: "javascript" },
      { scheme: "deno", language: "javascriptreact" },
      { scheme: "deno", language: "typescript" },
      { scheme: "deno", language: "typescriptreact" },
      { scheme: "deno", language: "json" },
      { scheme: "deno", language: "jsonc" },
      { scheme: "deno", language: "markdown" },
      { scheme: "deno", language: "html" },
      { scheme: "deno", language: "css" },
      { scheme: "deno", language: "scss" },
      { scheme: "deno", language: "sass" },
      { scheme: "deno", language: "less" },
      { scheme: "deno", language: "yaml" },
      { scheme: "deno", language: "sql" },
      { scheme: "deno", language: "svelte" },
      { scheme: "deno", language: "vue" },
      { scheme: "deno", language: "astro" },
      { scheme: "deno", language: "vento" },
      { scheme: "deno", language: "nunjucks" },
      { scheme: "vscode-userdata", language: "jsonc" },
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
      const denoConfiguration = vscode.workspace.getConfiguration().get(
        EXTENSION_NS,
      ) as Record<string, unknown>;
      commands.transformDenoConfiguration(extensionContext, denoConfiguration);
      return {
        ...denoConfiguration,
        javascript: vscode.workspace.getConfiguration().get("javascript"),
        typescript: vscode.workspace.getConfiguration().get("typescript"),
        enableBuiltinCommands: true,
      } as object;
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
      new DenoDebugConfigurationProvider(extensionContext),
    ),
  );

  // Activate the task provider.
  context.subscriptions.push(activateTaskProvider(extensionContext));

  extensionContext.maxTsServerMemory =
    vscode.workspace.getConfiguration(EXTENSION_NS).get("maxTsServerMemory") ??
      null;
  refreshEnableSettings(extensionContext);

  extensionContext.tsApi = getTsApi(() => {
    return {
      enableSettingsUnscoped: extensionContext.enableSettingsUnscoped,
      enableSettingsByFolder: extensionContext.enableSettingsByFolder,
      scopesWithDenoJson: Array.from(extensionContext.scopesWithDenoJson ?? []),
      npmCache: extensionContext.denoInfoJson?.npmCache ?? null,
    };
  });

  extensionContext.tasksSidebar = registerSidebar(
    extensionContext,
    context.subscriptions,
  )!;
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("deno.defaultTaskCommand")) {
      extensionContext.tasksSidebar.refresh();
    }
  }));

  const registerCommand = createRegisterCommand(context);
  registerCommand("deno.client.showReferences", commands.showReferences);
  // TODO(nayeemrmn): LSP versions <= 1.40.2 use this alias. Remove it
  // eventually.
  registerCommand("deno.showReferences", commands.showReferences);
  registerCommand("deno.client.test", commands.test);
  // TODO(nayeemrmn): LSP versions <= 1.40.2 use this alias. Remove it
  // eventually.
  registerCommand("deno.test", commands.test);
  registerCommand(
    "deno.client.cacheActiveDocument",
    commands.cacheActiveDocument,
  );
  registerCommand(
    "deno.client.clearHiddenPromptStorage",
    commands.clearHiddenPromptStorage,
  );
  registerCommand("deno.client.restart", commands.startLanguageServer);
  registerCommand("deno.client.info", commands.info);
  registerCommand("deno.client.status", commands.status);
  registerCommand("deno.client.welcome", commands.welcome);
  registerCommand("deno.client.enable", commands.enable);
  // Legacy alias for `deno.client.enable`.
  registerCommand("deno.client.initializeWorkspace", commands.enable);
  registerCommand("deno.client.disable", commands.disable);
  registerCommand("deno.client.statusBarClicked", commands.statusBarClicked);

  await commands.startLanguageServer(context, extensionContext)();
}

export function deactivate(): Thenable<void> | undefined {
  if (!extensionContext.client) {
    return undefined;
  }

  const client = extensionContext.client;
  extensionContext.client = undefined;
  for (const disposable of extensionContext.clientSubscriptions ?? []) {
    disposable.dispose();
  }
  extensionContext.clientSubscriptions = undefined;
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

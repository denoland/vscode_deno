// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

/** Contains handlers for commands that are enabled in Visual Studio Code for
 * the extension. */

import {
  ENABLEMENT_FLAG,
  EXTENSION_NS,
  LANGUAGE_CLIENT_ID,
  LANGUAGE_CLIENT_NAME,
  SERVER_SEMVER,
} from "./constants";
import { pickInitWorkspace } from "./initialize_project";
import {
  cache as cacheReq,
  reloadImportRegistries as reloadImportRegistriesReq,
} from "./lsp_extensions";
import * as tasks from "./tasks";
import { DenoTestController, TestingFeature } from "./testing";
import type { DenoExtensionContext, TestCommandOptions } from "./types";
import { WelcomePanel } from "./welcome";
import {
  assert,
  getDenoCommandName,
  getDenoCommandPath,
  getInspectArg,
} from "./util";
import { registryState } from "./lsp_extensions";
import { createRegistryStateHandler } from "./notification_handlers";
import { DenoServerInfo } from "./server_info";

import * as semver from "semver";
import * as vscode from "vscode";
import { LanguageClient, ServerOptions } from "vscode-languageclient/node";
import type {
  DocumentUri,
  Location,
  Position,
} from "vscode-languageclient/node";
import { getWorkspacesEnabledInfo } from "./enable";

// deno-lint-ignore no-explicit-any
export type Callback = (...args: any[]) => unknown;
export type Factory = (
  context: vscode.ExtensionContext,
  extensionContext: DenoExtensionContext,
) => Callback;

/** For the current document active in the editor tell the Deno LSP to cache
 * the file and all of its dependencies in the local cache. */
export function cache(
  _context: vscode.ExtensionContext,
  extensionContext: DenoExtensionContext,
): Callback {
  return (uris: DocumentUri[] = [], referrer: DocumentUri) => {
    const client = extensionContext.client;
    if (!client) {
      return;
    }
    return vscode.window.withProgress({
      location: vscode.ProgressLocation.Window,
      title: "caching",
    }, () => {
      return client.sendRequest(
        cacheReq,
        {
          referrer: { uri: referrer },
          uris: uris.map((uri) => ({
            uri,
          })),
        },
      );
    });
  };
}

export function cacheActiveDocument(
  _context: vscode.ExtensionContext,
  _extensionContext: DenoExtensionContext,
): Callback {
  return () => {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      return;
    }
    const uri = activeEditor.document.uri.toString();
    return vscode.window.withProgress({
      location: vscode.ProgressLocation.Window,
      title: "caching",
    }, () => {
      return vscode.commands.executeCommand("deno.cache", [uri], uri);
    });
  };
}

export function initializeWorkspace(
  _context: vscode.ExtensionContext,
  _extensionContext: DenoExtensionContext,
): Callback {
  return async () => {
    try {
      const settings = await pickInitWorkspace();
      const config = vscode.workspace.getConfiguration(EXTENSION_NS);
      await config.update("enable", true);

      const lintInspect = config.inspect("lint");
      assert(lintInspect);
      const unstableInspect = config.inspect("unstable");
      assert(unstableInspect);

      await config.update("lint", settings.lint);
      await config.update("unstable", settings.unstable);

      await vscode.window.showInformationMessage(
        "Deno is now setup in this workspace.",
      );
    } catch {
      vscode.window.showErrorMessage("Deno project initialization failed.");
    }
  };
}

export function reloadImportRegistries(
  _context: vscode.ExtensionContext,
  extensionContext: DenoExtensionContext,
): Callback {
  return () => extensionContext.client?.sendRequest(reloadImportRegistriesReq);
}

/** Start (or restart) the Deno Language Server */
export function startLanguageServer(
  context: vscode.ExtensionContext,
  extensionContext: DenoExtensionContext,
): Callback {
  return async () => {
    // Stop the existing language server and reset the state
    if (extensionContext.client) {
      const client = extensionContext.client;
      extensionContext.client = undefined;
      extensionContext.testController?.dispose();
      extensionContext.testController = undefined;
      extensionContext.statusBar.refresh(extensionContext);
      vscode.commands.executeCommand("setContext", ENABLEMENT_FLAG, false);
      await client.stop();
    }

    // Start a new language server
    const command = await getDenoCommandPath();
    if (command == null) {
      const message =
        "Could not resolve Deno executable. Please ensure it is available " +
        `on the PATH used by VS Code or set an explicit "deno.path" setting.`;

      // only show the message if the user has enabled deno or they have
      // a deno configuration file and haven't explicitly disabled deno
      const enabledInfo = await getWorkspacesEnabledInfo();
      const shouldShowMessage = enabledInfo
        .some((e) => e.enabled || e.hasDenoConfig && e.enabled !== false);
      if (shouldShowMessage) {
        vscode.window.showErrorMessage(message);
      }
      extensionContext.outputChannel.appendLine(`Error: ${message}`);
      return;
    }

    const env = {
      ...process.env,
      "DENO_V8_FLAGS": getV8Flags(),
      "NO_COLOR": true,
    };

    const serverOptions: ServerOptions = {
      run: {
        command,
        args: ["lsp"],
        options: { env },
      },
      debug: {
        command,
        // disabled for now, as this gets super chatty during development
        // args: ["lsp", "-L", "debug"],
        args: ["lsp"],
        options: { env },
      },
    };
    const client = new LanguageClient(
      LANGUAGE_CLIENT_ID,
      LANGUAGE_CLIENT_NAME,
      serverOptions,
      {
        outputChannel: extensionContext.outputChannel,
        ...extensionContext.clientOptions,
      },
    );
    const testingFeature = new TestingFeature();
    client.registerFeature(testingFeature);
    await client.start();

    // set this after a successful start
    extensionContext.client = client;

    vscode.commands.executeCommand("setContext", ENABLEMENT_FLAG, true);
    extensionContext.serverInfo = new DenoServerInfo(
      client.initializeResult?.serverInfo,
    );
    extensionContext.serverCapabilities = client.initializeResult?.capabilities;
    extensionContext.statusBar.refresh(extensionContext);

    if (testingFeature.enabled) {
      context.subscriptions.push(new DenoTestController(extensionContext));
    }

    context.subscriptions.push(
      client.onNotification(
        registryState,
        createRegistryStateHandler(),
      ),
    );

    extensionContext.tsApi.refresh();

    if (
      semver.valid(extensionContext.serverInfo.version) &&
      !semver.satisfies(extensionContext.serverInfo.version, SERVER_SEMVER)
    ) {
      notifyServerSemver(extensionContext.serverInfo.version);
    } else {
      showWelcomePageIfFirstUse(context, extensionContext);
    }
  };

  function getV8Flags() {
    let v8Flags = process.env.DENO_V8_FLAGS ?? "";
    const hasMaxOldSpaceSizeFlag = v8Flags.includes("--max-old-space-size=") ||
      v8Flags.includes("--max_old_space_size=");
    if (
      hasMaxOldSpaceSizeFlag &&
      extensionContext.workspaceSettings.maxTsServerMemory == null
    ) {
      // the v8 flags already include a max-old-space-size and the user
      // has not provided a maxTsServerMemory value
      return v8Flags;
    }
    // Use the same defaults and minimum as vscode uses for this setting
    // https://github.com/microsoft/vscode/blob/48d4ba271686e8072fc6674137415bc80d936bc7/extensions/typescript-language-features/src/configuration/configuration.ts#L213-L214
    const maxTsServerMemory = Math.max(
      128,
      extensionContext.workspaceSettings.maxTsServerMemory ?? 3072,
    );
    if (v8Flags.length > 0) {
      v8Flags += ",";
    }
    // flags at the end take precedence
    v8Flags += `--max-old-space-size=${maxTsServerMemory}`;
    return v8Flags;
  }
}

function notifyServerSemver(serverVersion: string) {
  return vscode.window.showWarningMessage(
    `The version of Deno language server ("${serverVersion}") does not meet the requirements of the extension ("${SERVER_SEMVER}"). Please update Deno and restart.`,
    "OK",
  );
}

function showWelcomePageIfFirstUse(
  context: vscode.ExtensionContext,
  extensionContext: DenoExtensionContext,
) {
  const welcomeShown = context.globalState.get<boolean>("deno.welcomeShown") ??
    false;

  if (!welcomeShown) {
    welcome(context, extensionContext)();
    context.globalState.update("deno.welcomeShown", true);
  }
}

export function showReferences(
  _content: vscode.ExtensionContext,
  extensionContext: DenoExtensionContext,
): Callback {
  return (uri: string, position: Position, locations: Location[]) => {
    if (!extensionContext.client) {
      return;
    }
    vscode.commands.executeCommand(
      "editor.action.showReferences",
      vscode.Uri.parse(uri),
      extensionContext.client.protocol2CodeConverter.asPosition(position),
      locations.map(extensionContext.client.protocol2CodeConverter.asLocation),
    );
  };
}

/** Open and display the "virtual document" which provides the status of the
 * Deno Language Server. */
export function status(
  _context: vscode.ExtensionContext,
  _extensionContext: DenoExtensionContext,
): Callback {
  return () => {
    const uri = vscode.Uri.parse("deno:/status.md");
    return vscode.commands.executeCommand("markdown.showPreviewToSide", uri);
  };
}

export function test(
  _context: vscode.ExtensionContext,
  extensionContext: DenoExtensionContext,
): Callback {
  return async (uriStr: string, name: string, options: TestCommandOptions) => {
    const uri = vscode.Uri.parse(uriStr, true);
    const path = uri.fsPath;
    const config = vscode.workspace.getConfiguration(EXTENSION_NS, uri);
    const testArgs: string[] = [
      ...(config.get<string[]>("codeLens.testArgs") ?? []),
    ];
    if (config.get("unstable")) {
      testArgs.push("--unstable");
    }
    if (options?.inspect) {
      testArgs.push(getInspectArg(extensionContext.serverInfo?.version));
    }
    if (!testArgs.includes("--import-map")) {
      const importMap: string | undefined | null = config.get("importMap");
      if (importMap?.trim()) {
        testArgs.push("--import-map", importMap.trim());
      }
    }
    const env = {} as Record<string, string>;
    const cacheDir: string | undefined | null = config.get("cache");
    if (cacheDir?.trim()) {
      env["DENO_DIR"] = cacheDir.trim();
    }
    const nameRegex = `/^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$/`;
    const args = ["test", ...testArgs, "--filter", nameRegex, path];

    const definition: tasks.DenoTaskDefinition = {
      type: tasks.TASK_TYPE,
      command: "test",
      args,
      env,
    };

    assert(vscode.workspace.workspaceFolders);
    const target = vscode.workspace.workspaceFolders[0];
    const denoCommand = await getDenoCommandName();
    const task = tasks.buildDenoTask(
      target,
      denoCommand,
      definition,
      `test "${name}"`,
      args,
      ["$deno-test"],
    );

    task.presentationOptions = {
      reveal: vscode.TaskRevealKind.Always,
      panel: vscode.TaskPanelKind.Dedicated,
      clear: true,
    };
    task.group = vscode.TaskGroup.Test;

    const createdTask = await vscode.tasks.executeTask(task);

    if (options?.inspect) {
      await vscode.debug.startDebugging(target, {
        name,
        request: "attach",
        type: "node",
      });
    }

    return createdTask;
  };
}

export function welcome(
  context: vscode.ExtensionContext,
  _extensionContext: DenoExtensionContext,
): Callback {
  return () => {
    WelcomePanel.createOrShow(context.extensionUri);
  };
}

export function openOutput(
  _context: vscode.ExtensionContext,
  extensionContext: DenoExtensionContext,
) {
  return () => {
    extensionContext.outputChannel.show(true);
  };
}

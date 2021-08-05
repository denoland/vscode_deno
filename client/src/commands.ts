// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.

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
import type { DenoExtensionContext } from "./types";
import { WelcomePanel } from "./welcome";
import { assert, getDenoCommand } from "./util";
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
  return (uris: DocumentUri[] = []) => {
    const activeEditor = vscode.window.activeTextEditor;
    const client = extensionContext.client;
    if (!activeEditor || !client) {
      return;
    }
    return vscode.window.withProgress({
      location: vscode.ProgressLocation.Window,
      title: "caching",
    }, () => {
      return client.sendRequest(
        cacheReq,
        {
          referrer: { uri: activeEditor.document.uri.toString() },
          uris: uris.map((uri) => ({
            uri,
          })),
        },
      );
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
      extensionContext.statusBar.refresh(extensionContext);
      vscode.commands.executeCommand("setContext", ENABLEMENT_FLAG, false);
      await client.stop();
    }

    // Start a new language server
    const command = await getDenoCommand();
    const serverOptions: ServerOptions = {
      run: {
        command,
        args: ["lsp"],
        // deno-lint-ignore no-undef
        options: { env: { ...process.env, "NO_COLOR": true } },
      },
      debug: {
        command,
        // disabled for now, as this gets super chatty during development
        // args: ["lsp", "-L", "debug"],
        args: ["lsp"],
        // deno-lint-ignore no-undef
        options: { env: { ...process.env, "NO_COLOR": true } },
      },
    };
    const client = new LanguageClient(
      LANGUAGE_CLIENT_ID,
      LANGUAGE_CLIENT_NAME,
      serverOptions,
      extensionContext.clientOptions,
    );
    context.subscriptions.push(client.start());
    await client.onReady();

    // set this after a successful start
    extensionContext.client = client;

    vscode.commands.executeCommand("setContext", ENABLEMENT_FLAG, true);
    extensionContext.serverInfo = new DenoServerInfo(
      client.initializeResult?.serverInfo,
    );
    extensionContext.statusBar.refresh(extensionContext);

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
  _extensionContext: DenoExtensionContext,
): Callback {
  return async (uriStr: string, name: string) => {
    const uri = vscode.Uri.parse(uriStr, true);
    const path = uri.fsPath;
    const config = vscode.workspace.getConfiguration(EXTENSION_NS, uri);
    const testArgs: string[] = [
      ...(config.get<string[]>("codeLens.testArgs") ?? []),
    ];
    if (config.get("unstable")) {
      testArgs.push("--unstable");
    }
    if (config.has("importMap")) {
      testArgs.push("--import-map", String(config.get("importMap")));
    }
    const env = config.has("cache")
      ? { "DENO_DIR": config.get("cache") } as Record<string, string>
      : undefined;
    const args = ["test", ...testArgs, "--filter", name, path];

    const definition: tasks.DenoTaskDefinition = {
      type: tasks.TASK_TYPE,
      command: "test",
      args,
      cwd: ".",
      env,
    };

    assert(vscode.workspace.workspaceFolders);
    const target = vscode.workspace.workspaceFolders[0];
    const task = await tasks.buildDenoTask(
      target,
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

    return vscode.tasks.executeTask(task);
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

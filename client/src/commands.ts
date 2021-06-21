// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.

/** Contains handlers for commands that are enabled in Visual Studio Code for
 * the extension. */

import {
  ENABLEMENT_FLAG,
  EXTENSION_NS,
  LANGUAGE_CLIENT_ID,
  LANGUAGE_CLIENT_NAME,
} from "./constants";
import { pickInitWorkspace } from "./initialize_project";
import {
  cache as cacheReq,
  reloadImportRegistries as reloadImportRegistriesReq,
} from "./lsp_extensions";
import * as tasks from "./tasks";
import type { DenoExtensionContext } from "./types";
import { WelcomePanel } from "./welcome";
import { assert, getDenoCommandAndVersion } from "./util";
import { registryState } from "./lsp_extensions";
import { createRegistryStateHandler } from "./notification_handlers";

import * as semver from "semver";
import * as vscode from "vscode";
import { LanguageClient, ServerOptions } from "vscode-languageclient/node";
import type {
  DocumentUri,
  Location,
  Position,
} from "vscode-languageclient/node";

/** The minimum version of Deno that this extension is designed to support. */
const SERVER_SEMVER = ">=1.11.2";

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
  { client }: DenoExtensionContext,
): Callback {
  return () => client?.sendRequest(reloadImportRegistriesReq);
}

/** Start (or restart) the Deno Language Server */
export function startLanguageServer(
  context: vscode.ExtensionContext,
  extensionContext: DenoExtensionContext,
): Callback {
  return async () => {
    // Reset the state and stop the existing language server
    const { statusBarItem } = extensionContext;
    if (extensionContext.client) {
      await extensionContext.client.stop();
      statusBarItem.hide();
      vscode.commands.executeCommand("setContext", ENABLEMENT_FLAG, false);
    }

    // Check the deno version before starting the language server
    // This is necessary because the `--parent-pid <pid>` flag for
    // `deno lsp` won't exist in deno versions < 1.11.2
    const { command, version } = await getDenoCommandAndVersion();
    if (version == null) {
      notifyDenoNotFound(command);
      return;
    } else if (!semver.satisfies(version, SERVER_SEMVER)) {
      notifyServerSemver(version.version);
      return;
    }

    // Start the new language server
    const args = ["lsp", "--parent-pid", process.pid.toString()];
    const serverOptions: ServerOptions = {
      run: {
        command,
        args,
        // deno-lint-ignore no-undef
        options: { env: { ...process.env, "NO_COLOR": true } },
      },
      debug: {
        command,
        // disabled for now, as this gets super chatty during development
        // args: [...args, "-L", "debug"],
        args,
        // deno-lint-ignore no-undef
        options: { env: { ...process.env, "NO_COLOR": true } },
      },
    };
    const client = extensionContext.client = new LanguageClient(
      LANGUAGE_CLIENT_ID,
      LANGUAGE_CLIENT_NAME,
      serverOptions,
      extensionContext.clientOptions,
    );
    context.subscriptions.push(client.start());
    await client.onReady();
    vscode.commands.executeCommand("setContext", ENABLEMENT_FLAG, true);
    const serverVersion = extensionContext.serverVersion =
      (client.initializeResult?.serverInfo?.version ?? "")
        .split(
          " ",
        )[0];
    statusBarItem.text = `Deno ${serverVersion}`;
    statusBarItem.tooltip = client
      .initializeResult?.serverInfo?.version;
    statusBarItem.show();

    context.subscriptions.push(
      extensionContext.client.onNotification(
        registryState,
        createRegistryStateHandler(),
      ),
    );

    showWelcomePageIfFirstUse(context, extensionContext);
  };
}

function notifyDenoNotFound(denoCommand: string) {
  return vscode.window.showWarningMessage(
    `Error resolving Deno executable. Please ensure Deno is on the PATH of this VS Code ` +
      `process or specify a path to the executable in the "deno.path" setting. Could not ` +
      `get version from command: ${denoCommand}`,
    "OK",
  );
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
    if (config.get("importMap")) {
      testArgs.push("--import-map", String(config.get("importMap")));
    }
    const args = ["test", ...testArgs, "--filter", name, path];

    const definition: tasks.DenoTaskDefinition = {
      type: tasks.TASK_TYPE,
      command: "test",
      args,
      cwd: ".",
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

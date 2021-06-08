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
import { assert } from "./util";

import * as vscode from "vscode";
import { LanguageClient } from "vscode-languageclient/node";
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
    if (!activeEditor) {
      return;
    }
    return vscode.window.withProgress({
      location: vscode.ProgressLocation.Window,
      title: "caching",
    }, () => {
      return extensionContext.client.sendRequest(
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
  return () => client.sendRequest(reloadImportRegistriesReq);
}

/** Start (or restart) the Deno Language Server */
export function startLanguageServer(
  context: vscode.ExtensionContext,
  extensionContext: DenoExtensionContext,
): Callback {
  return async () => {
    const { statusBarItem } = extensionContext;
    if (extensionContext.client) {
      await extensionContext.client.stop();
      statusBarItem.hide();
      vscode.commands.executeCommand("setContext", ENABLEMENT_FLAG, false);
    }
    const client = extensionContext.client = new LanguageClient(
      LANGUAGE_CLIENT_ID,
      LANGUAGE_CLIENT_NAME,
      extensionContext.serverOptions,
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
  };
}

export function showReferences(
  _content: vscode.ExtensionContext,
  extensionContext: DenoExtensionContext,
): Callback {
  return (uri: string, position: Position, locations: Location[]) => {
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

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
import type { DenoExtensionContext } from "./interfaces";
import {
  cache as cacheReq,
  reloadImportRegistries as reloadImportRegistriesReq,
} from "./lsp_extensions";
import { WelcomePanel } from "./welcome";

import {
  commands,
  ExtensionContext,
  ProgressLocation,
  Uri,
  window,
  workspace,
} from "vscode";
import { LanguageClient } from "vscode-languageclient/node";
import type {
  DocumentUri,
  Location,
  Position,
} from "vscode-languageclient/node";

// deno-lint-ignore no-explicit-any
export type Callback = (...args: any[]) => unknown;
export type Factory = (
  context: ExtensionContext,
  extensionContext: DenoExtensionContext,
) => Callback;

/** For the current document active in the editor tell the Deno LSP to cache
 * the file and all of its dependencies in the local cache. */
export function cache(
  _context: ExtensionContext,
  extensionContext: DenoExtensionContext,
): Callback {
  return (uris: DocumentUri[] = []) => {
    const activeEditor = window.activeTextEditor;
    if (!activeEditor) {
      return;
    }
    return window.withProgress({
      location: ProgressLocation.Window,
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
  _context: ExtensionContext,
  _extensionContext: DenoExtensionContext,
): Callback {
  return async () => {
    try {
      const settings = await pickInitWorkspace();
      const config = workspace.getConfiguration(EXTENSION_NS);
      await config.update("enable", true);
      await config.update("lint", settings.lint);
      await config.update("unstable", settings.unstable);
      await window.showInformationMessage(
        "Deno is now setup in this workspace.",
      );
    } catch {
      window.showErrorMessage("Deno project initialization failed.");
    }
  };
}

export function reloadImportRegistries(
  _context: ExtensionContext,
  { client }: DenoExtensionContext,
): Callback {
  return () => client.sendRequest(reloadImportRegistriesReq);
}

/** Start (or restart) the Deno Language Server */
export function startLanguageServer(
  context: ExtensionContext,
  extensionContext: DenoExtensionContext,
): Callback {
  return async () => {
    const { statusBarItem } = extensionContext;
    if (extensionContext.client) {
      await extensionContext.client.stop();
      statusBarItem.hide();
      commands.executeCommand("setContext", ENABLEMENT_FLAG, false);
    }
    const client = extensionContext.client = new LanguageClient(
      LANGUAGE_CLIENT_ID,
      LANGUAGE_CLIENT_NAME,
      extensionContext.serverOptions,
      extensionContext.clientOptions,
    );
    context.subscriptions.push(client.start());
    await client.onReady();
    commands.executeCommand("setContext", ENABLEMENT_FLAG, true);
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
  _content: ExtensionContext,
  extensionContext: DenoExtensionContext,
): Callback {
  return (uri: string, position: Position, locations: Location[]) => {
    commands.executeCommand(
      "editor.action.showReferences",
      Uri.parse(uri),
      extensionContext.client.protocol2CodeConverter.asPosition(position),
      locations.map(extensionContext.client.protocol2CodeConverter.asLocation),
    );
  };
}

/** Open and display the "virtual document" which provides the status of the
 * Deno Language Server. */
export function status(
  _context: ExtensionContext,
  _extensionContext: DenoExtensionContext,
): Callback {
  return () => {
    const uri = Uri.parse("deno:/status.md");
    return commands.executeCommand("markdown.showPreviewToSide", uri);
  };
}

export function welcome(
  context: ExtensionContext,
  _extensionContext: DenoExtensionContext,
): Callback {
  return () => {
    WelcomePanel.createOrShow(context.extensionUri);
  };
}

// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.

/** Contains handlers for commands that are enabled in Visual Studio Code for
 * the extension. */

import { EXTENSION_NS } from "./constants";
import { pickInitWorkspace } from "./initialize_project";
import { cache as cacheReq } from "./lsp_extensions";
import {
  commands,
  ExtensionContext,
  ProgressLocation,
  Uri,
  ViewColumn,
  window,
  workspace,
} from "vscode";
import {
  DocumentUri,
  LanguageClient,
  Location,
  Position,
} from "vscode-languageclient/node";

// deno-lint-ignore no-explicit-any
export type Callback = (...args: any[]) => unknown;
export type Factory = (
  context: ExtensionContext,
  client: LanguageClient,
) => Callback;

/** For the current document active in the editor tell the Deno LSP to cache
 * the file and all of its dependencies in the local cache. */
export function cache(
  _context: ExtensionContext,
  client: LanguageClient,
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
  _context: ExtensionContext,
  _client: LanguageClient,
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

export function showReferences(
  _content: ExtensionContext,
  client: LanguageClient,
): Callback {
  return (uri: string, position: Position, locations: Location[]) => {
    commands.executeCommand(
      "editor.action.showReferences",
      Uri.parse(uri),
      client.protocol2CodeConverter.asPosition(position),
      locations.map(client.protocol2CodeConverter.asLocation),
    );
  };
}

/** Open and display the "virtual document" which provides the status of the
 * Deno Language Server. */
export function status(
  _context: ExtensionContext,
  _client: LanguageClient,
): Callback {
  return async () => {
    const document = await workspace.openTextDocument(
      Uri.parse("deno:/status.md"),
    );
    return window.showTextDocument(document, ViewColumn.Two, true);
  };
}

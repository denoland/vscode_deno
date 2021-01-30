// Copyright 2018-2020 the Deno authors. All rights reserved. MIT license.

/** Contains handlers for commands that are enabled in Visual Studio Code for
 * the extension. */

import {
  commands,
  ExtensionContext,
  Uri,
  ViewColumn,
  window,
  workspace,
} from "vscode";
import { LanguageClient, Location, Position } from "vscode-languageclient";
import { cache as cacheReq } from "./lsp_extensions";

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
  return () => {
    const activeEditor = window.activeTextEditor;
    if (!activeEditor) {
      return;
    }
    return client.sendRequest(
      cacheReq,
      { textDocument: { uri: activeEditor.document.uri.toString() } },
    );
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

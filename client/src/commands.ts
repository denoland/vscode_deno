// Copyright 2018-2020 the Deno authors. All rights reserved. MIT license.

/** Contains handlers for commands that are enabled in Visual Studio Code for
 * the extension. */

import { ExtensionContext, Uri, ViewColumn, window, workspace } from "vscode";
import { LanguageClient } from "vscode-languageclient";
import { cache as cache_req, CacheParams } from "./lsp_extensions";

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
  return async () => {
    const activeEditor = window.activeTextEditor;
    if (!activeEditor) {
      return;
    }
    return client.sendRequest(
      cache_req,
      { textDocument: { uri: activeEditor.document.uri.toString() } },
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

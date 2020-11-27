// Copyright 2018-2020 the Deno authors. All rights reserved. MIT license.

/** Contains handlers for commands that are enabled in Visual Studio Code for
 * the extension. */

import { ExtensionContext, Uri, ViewColumn, window, workspace } from "vscode";
import { LanguageClient } from "vscode-languageclient";

// deno-lint-ignore no-explicit-any
export type Callback = (...args: any[]) => unknown;
export type Factory = (
  context: ExtensionContext,
  client: LanguageClient,
) => Callback;

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

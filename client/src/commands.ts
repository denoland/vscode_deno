// Copyright 2018-2020 the Deno authors. All rights reserved. MIT license.

/** Contains handlers for commands that are enabled in Visual Studio Code for
 * the extension. */

import * as lspExtensions from "./lsp_extensions";
import {
  EventEmitter,
  ExtensionContext,
  ProviderResult,
  TextDocumentContentProvider,
  Uri,
  ViewColumn,
  window,
  workspace,
} from "vscode";
import { LanguageClient } from "vscode-languageclient";

export type Callback = (...args: any[]) => unknown;
export type Factory = (
  context: ExtensionContext,
  client: LanguageClient,
) => Callback;

class StatusDocumentProvider implements TextDocumentContentProvider {
  #client: LanguageClient;
  readonly eventEmitter = new EventEmitter<Uri>();
  readonly uri = Uri.parse("deno:///status.md");

  constructor(client: LanguageClient) {
    this.#client = client;
  }

  provideTextDocumentContent(_uri: Uri): ProviderResult<string> {
    if (!window.activeTextEditor) {
      return "";
    }
    return this.#client.sendRequest(lspExtensions.status, {});
  }
}

/** Send a status request to the Deno Language Server, and take the response
 * and display it as a read only document in the editor. */
export function status(
  context: ExtensionContext,
  client: LanguageClient,
): Callback {
  const statusDocProvider = new StatusDocumentProvider(client);
  let poller: NodeJS.Timer | undefined;

  context.subscriptions.push(
    workspace.registerTextDocumentContentProvider("deno", statusDocProvider),
    {
      dispose() {
        if (poller != undefined) {
          clearInterval(poller);
        }
      },
    },
  );

  return async () => {
    if (poller === undefined) {
      poller = setInterval(
        () => statusDocProvider.eventEmitter.fire(statusDocProvider.uri),
        1000,
      );
    }
    const document = await workspace.openTextDocument(statusDocProvider.uri);
    return window.showTextDocument(document, ViewColumn.Two, true);
  };
}

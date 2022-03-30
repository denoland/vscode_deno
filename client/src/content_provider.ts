// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

import { virtualTextDocument } from "./lsp_extensions";
import type { DenoExtensionContext } from "./types";

import type {
  CancellationToken,
  ProviderResult,
  TextDocumentContentProvider,
  Uri,
} from "vscode";

export const SCHEME = "deno";

export class DenoTextDocumentContentProvider
  implements TextDocumentContentProvider {
  constructor(private extensionContext: DenoExtensionContext) {}

  provideTextDocumentContent(
    uri: Uri,
    token: CancellationToken,
  ): ProviderResult<string> {
    if (!this.extensionContext.client) {
      throw new Error("Deno language server has not started.");
    }

    return this.extensionContext.client.sendRequest(
      virtualTextDocument,
      { textDocument: { uri: uri.toString() } },
      token,
    );
  }
}

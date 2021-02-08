// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.

import { virtualTextDocument } from "./lsp_extensions";
import type {
  CancellationToken,
  ProviderResult,
  TextDocumentContentProvider,
  Uri,
} from "vscode";
import type { LanguageClient } from "vscode-languageclient/node";

export const SCHEME = "deno";

export class DenoTextDocumentContentProvider
  implements TextDocumentContentProvider {
  constructor(private client: LanguageClient) {}

  provideTextDocumentContent(
    uri: Uri,
    token: CancellationToken,
  ): ProviderResult<string> {
    return this.client.sendRequest(
      virtualTextDocument,
      { textDocument: { uri: uri.toString() } },
      token,
    );
  }
}

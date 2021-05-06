// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.
import {
  CancellationToken,
  CodeLens,
  CodeLensProvider,
  TextDocument,
} from "vscode";
import { DenoExtensionContext } from "./interfaces";
import { testCodeLens } from "./lsp_extensions";

export class DenoTestCodeLensProvider implements CodeLensProvider {
  constructor(private extensionContext: DenoExtensionContext) {}
  public async provideCodeLenses(
    document: TextDocument,
    token: CancellationToken
  ): Promise<CodeLens[] | null | undefined> {
    console.log(document.uri.toString());
    const result = await this.extensionContext.client.sendRequest(
      testCodeLens,
      { textDocument: { uri: document.uri.toString() } },
      token
    );
    console.log(result)
    return result;
  }
}

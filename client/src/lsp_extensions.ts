// Copyright 2018-2020 the Deno authors. All rights reserved. MIT license.

/** Contains extensions to the Language Server Protocol that are support by the
 * Deno Language Server.
 * 
 * The requests and notifications types should mirror the Deno's CLI
 * `cli/lsp/lsp_extensions.rs` module.
 */

import { RequestType } from "vscode-languageclient";
import type { TextDocumentIdentifier } from "vscode-languageclient";

export interface VirtualTextDocumentParams {
  textDocument: TextDocumentIdentifier;
}

export const virtualTextDocument = new RequestType<
  VirtualTextDocumentParams,
  string,
  void
>("deno/virtualTextDocument");

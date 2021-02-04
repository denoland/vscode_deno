// Copyright 2018-2020 the Deno authors. All rights reserved. MIT license.

/** Contains extensions to the Language Server Protocol that are supported by
 * the Deno Language Server.
 * 
 * The requests and notifications types should mirror the Deno's CLI
 * `cli/lsp/language_server.rs` under the method `request_else`.
 */

import { RequestType } from "vscode-languageclient";
import type { TextDocumentIdentifier } from "vscode-languageclient";

export interface CacheParams {
  textDocument: TextDocumentIdentifier;
}

export const cache = new RequestType<CacheParams, boolean, void>("deno/cache");

export interface VirtualTextDocumentParams {
  textDocument: TextDocumentIdentifier;
}

export const virtualTextDocument = new RequestType<
  VirtualTextDocumentParams,
  string,
  void
>("deno/virtualTextDocument");

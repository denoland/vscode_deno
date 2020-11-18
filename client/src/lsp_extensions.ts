// Copyright 2018-2020 the Deno authors. All rights reserved. MIT license.

/** Contains extensions to the Language Server Protocol that are support by the
 * Deno Language Server.
 * 
 * The requests and notifications types should mirror the Deno's CLI
 * `cli/lsp/lsp_extensions.rs` module.
 */

import { RequestType, TextDocumentIdentifier } from "vscode-languageclient";

export interface StatusParams {
  /** The open document in the editor, which potentially the status can be
	 * specific to that document. */
  textDocument?: TextDocumentIdentifier;
}

/** Request status information of the Deno Language Server, which will be a
 * returned as a string. */
export const status = new RequestType<StatusParams, string, void>(
  "deno/status",
);

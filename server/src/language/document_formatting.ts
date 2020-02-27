import {
  IConnection,
  TextDocuments,
  TextEdit,
  Range
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { deno } from "../deno";
import { Bridge } from "../bridge";

export class DocumentFormatting {
  constructor(
    connection: IConnection,
    documents: TextDocuments<TextDocument>,
    bridge: Bridge
  ) {
    connection.onDocumentFormatting(async params => {
      const uri = params.textDocument.uri;
      const doc = documents.get(uri);

      if (!doc) {
        return;
      }

      const text = doc.getText();

      const workspaceFolder = await bridge.getWorkspace(uri);

      const cwd = workspaceFolder ? workspaceFolder.uri.fsPath : "./";

      const formatted = await deno.format(text, { cwd });

      const start = doc.positionAt(0);
      const end = doc.positionAt(text.length);

      const range = Range.create(start, end);

      return [TextEdit.replace(range, formatted)];
    });

    connection.onDocumentRangeFormatting(async params => {
      const uri = params.textDocument.uri;
      const range = params.range;
      const doc = documents.get(uri);

      if (!doc) {
        return;
      }

      const text = doc.getText(range);

      const workspaceFolder = await bridge.getWorkspace(uri);

      const cwd = workspaceFolder ? workspaceFolder.uri.fsPath : "./";

      const formatted = await deno.format(text, { cwd });

      // why trim it?
      // Because we are just formatting some of them, we don't need to keep the trailing \n
      return [TextEdit.replace(range, formatted.trim())];
    });
  }
}

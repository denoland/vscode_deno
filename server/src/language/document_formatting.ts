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

      connection.console.log(
        `Formatting '${uri.toString()}' at ${
          workspaceFolder ? workspaceFolder.uri.fsPath : ""
        }`
      );

      const formatted = await deno.format(text, {
        cwd
      });

      const start = doc.positionAt(0);
      const end = doc.positionAt(text.length);

      const range = Range.create(start, end);

      return [TextEdit.replace(range, formatted)];
    });
  }
}

import {
  IConnection,
  TextDocuments,
  MarkedString,
  Hover as LanguageServerHover
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { getDenoTypesHintsFromDocument } from "../deno_types";

export class Hover {
  constructor(connection: IConnection, documents: TextDocuments<TextDocument>) {
    connection.onHover(async params => {
      const { textDocument, position } = params;
      const document = documents.get(textDocument.uri);

      if (!document) {
        return;
      }

      const denoTypesComments = getDenoTypesHintsFromDocument(document);

      for (const typeComment of denoTypesComments) {
        const start = typeComment.range.start;
        const end = typeComment.range.end;
        if (
          position.line >= start.line &&
          position.line <= end.line &&
          position.character >= start.character &&
          position.character <= end.character
        ) {
          const hover: LanguageServerHover = {
            range: typeComment.contentRange,
            contents: [
              MarkedString.fromPlainText(
                "Deno's external declaration library. For more detail: https://deno.land/std/manual.md"
              )
            ]
          };

          return hover;
        }
      }

      return;
    });
  }
}

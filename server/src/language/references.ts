import {
  IConnection,
  Range,
  TextDocuments,
  Location
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import * as ts from "typescript";
import { URI } from "vscode-uri";

import { getDenoTypesHintsFromDocument } from "../deno_types";

export class References {
  constructor(connection: IConnection, documents: TextDocuments<TextDocument>) {
    connection.onReferences(async params => {
      const { textDocument, position } = params;
      const document = documents.get(textDocument.uri);

      if (!document) {
        return;
      }

      const locations: Location[] = [];

      const denoTypesComments = getDenoTypesHintsFromDocument(document);

      for (const typeComment of denoTypesComments) {
        const start = typeComment.contentRange.start;
        const end = typeComment.contentRange.end;
        if (
          position.line >= start.line &&
          position.line <= end.line &&
          position.character >= start.character &&
          position.character <= end.character
        ) {
          if (ts.sys.fileExists(typeComment.filepath)) {
            locations.push(
              Location.create(
                URI.file(typeComment.filepath).toString(),
                Range.create(0, 0, 0, 0)
              )
            );
          }
        }
      }

      return locations;
    });
  }
}

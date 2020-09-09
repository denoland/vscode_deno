import {
  IConnection,
  TextDocuments,
  DocumentHighlight as LanguageServerDocumentHighlight,
  DocumentHighlightKind,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { getDenoTypesHintsFromDocument } from "../deno_types";

import Plugable from "../Plugable";

export class DocumentHighlight implements Plugable {
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  constructor(
    private enabled: boolean,
    connection: IConnection,
    documents: TextDocuments<TextDocument>
  ) {
    connection.onDocumentHighlight(async (params) => {
      if (!this.enabled) return;
      const { textDocument, position } = params;
      const document = documents.get(textDocument.uri);

      if (!document) {
        return [];
      }

      const denoTypesComments = getDenoTypesHintsFromDocument(document);

      const highlights: LanguageServerDocumentHighlight[] = [];

      for (const typeComment of denoTypesComments) {
        const start = typeComment.range.start;
        const end = typeComment.range.end;
        if (
          position.line >= start.line &&
          position.line <= end.line &&
          position.character >= start.character &&
          position.character <= end.character
        ) {
          highlights.push(
            LanguageServerDocumentHighlight.create(
              typeComment.contentRange,
              DocumentHighlightKind.Write
            )
          );
        }
      }

      return highlights;
    });
  }
}

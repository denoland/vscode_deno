import {
  IConnection,
  TextDocuments,
  MarkedString,
  Hover as LanguageServerHover,
  MarkupKind,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { deno } from "../deno";
import { getDenoTypesHintsFromDocument } from "../deno_types";
import { getDenoLintCodesFromDocument } from "../deno_lint";

export class Hover {
  constructor(connection: IConnection, documents: TextDocuments<TextDocument>) {
    connection.onHover(async (params) => {
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
                "Deno's external declaration library. For more detail: https://deno.land/manual/getting_started/typescript#compiler-hint"
              ),
            ],
          };

          return hover;
        }
      }

      const denoLintCodes = getDenoLintCodesFromDocument(document);

      for (const code of denoLintCodes) {
        const start = code.range.start;
        const end = code.range.end;
        if (
          position.line >= start.line &&
          position.line <= end.line &&
          position.character >= start.character &&
          position.character <= end.character
        ) {
          const rules = await deno.getLintRules();
          const rule = rules.find((r) => r.code == code.code);

          if (rule) {
            const hover: LanguageServerHover = {
              range: code.range,
              contents: {
                kind: MarkupKind.Markdown,
                value: `## ${rule.code}\n${
                  rule?.docs || "_no docs available_\n"
                }\n<br />`,
              },
            };
            return hover;
          }
        }
      }
      return;
    });
  }
}

import {
  IConnection,
  Range,
  TextDocuments,
  CompletionItem,
  CompletionItemKind,
  Position
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { getDenoDir } from "../../../core/deno";
import { getDenoDeps } from "../../../core/deno_deps";

export class Completion {
  constructor(connection: IConnection, documents: TextDocuments<TextDocument>) {
    connection.onCompletion(async params => {
      const { position, partialResultToken, textDocument } = params;

      const doc = documents.get(textDocument.uri);

      if (!doc) {
        return [];
      }

      const currentLine = doc.getText(
        Range.create(Position.create(position.line, 0), position)
      );

      const IMPORT_REG = /import\s['"][a-zA-Z\._-]$/;
      const IMPORT_FROM_REG = /import\s(([^\s]*)|(\*\sas\s[^\s]*))\sfrom\s['"][a-zA-Z\._-]$/;
      const DYNAMIC_REG = /import\s*\(['"][a-zA-Z\._-]['"]?$/;

      const isImport =
        IMPORT_REG.test(currentLine) || // import "https://xxxx.xxxx"
        IMPORT_FROM_REG.test(currentLine) || // import xxxx from "https://xxxx.xxxx"
        DYNAMIC_REG.test(currentLine); // import("https://xxxx.xxxx")

      if (
        currentLine.length > 1000 || // if is a large file
        !isImport
      ) {
        return [];
      }

      const deps = await getDenoDeps();

      const range = Range.create(
        Position.create(position.line, position.character),
        position
      );

      const completes: CompletionItem[] = deps.map(dep => {
        return {
          label: dep.url,
          detail: dep.url,
          sortText: dep.url,
          documentation: dep.filepath.replace(getDenoDir(), "$DENO_DIR"),
          kind: CompletionItemKind.File,
          insertText: dep.url,
          cancel: partialResultToken,
          range: range
        } as CompletionItem;
      });

      return completes;
    });
  }
}

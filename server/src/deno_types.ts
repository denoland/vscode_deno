import { TextDocument } from "vscode-languageserver-textdocument";
import * as ts from "typescript";
import { URI } from "vscode-uri";

import { getDenoCompileHint } from "../../core/deno_type_hint";

/**
 * Get @deno-types hint comments from a Document
 * @param document
 */
export function getDenoTypesHintsFromDocument(document: TextDocument) {
  const uri = URI.parse(document.uri);

  const sourceFile = ts.createSourceFile(
    uri.fsPath,
    document.getText(),
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TSX
  );

  return getDenoCompileHint(ts)(sourceFile);
}

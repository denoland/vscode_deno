import { TextDocument } from "vscode-languageserver-textdocument";
import * as ts from "typescript";
import { URI } from "vscode-uri";

import { getLintCodes, LintCode } from "../../core/deno_lint_codes";

/**
 * Get deno-lint hint comments from a Document
 * @param document
 */
export function getDenoLintCodesFromDocument(
  document: TextDocument
): LintCode[] {
  const uri = URI.parse(document.uri);

  const sourceFile = ts.createSourceFile(
    uri.fsPath,
    document.getText(),
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TSX
  );

  return getLintCodes(ts)(sourceFile);
}

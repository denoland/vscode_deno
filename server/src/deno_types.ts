import * as path from "path";

import { Position, Range } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import * as ts from "typescript";
import { URI } from "vscode-uri";

interface CommentRange extends ts.CommentRange {
  text: string;
  module: string;
  filepath: string;
  range: Range;
  contentRange: Range;
}

/**
 * Get @deno-types hint comments from a SourceFile
 * @param sourceFile
 */
export function getDenoTypesHintsFromSourceFile(
  sourceFile: ts.SourceFile
): CommentRange[] {
  const denoTypesComments: CommentRange[] = [];

  const comments =
    ts.getLeadingCommentRanges(sourceFile.getFullText(), 0) || [];

  for (const comment of comments) {
    if (comment.hasTrailingNewLine) {
      const text = sourceFile.getFullText().substring(comment.pos, comment.end);
      const regexp = /@deno-types=['"]([^'"]+)['"]/;

      const matchers = regexp.exec(text);

      if (matchers) {
        const start = sourceFile.getLineAndCharacterOfPosition(comment.pos);
        const end = sourceFile.getLineAndCharacterOfPosition(comment.end);

        const moduleNameStart = Position.create(
          start.line,
          start.character + '// @deno-types="'.length
        );
        const moduleNameEnd = Position.create(
          end.line,
          end.character - '"'.length
        );

        const moduleName = matchers[1];

        const moduleFilepath = moduleName.replace(/\//gm, path.sep);

        const targetFilepath = path.isAbsolute(moduleFilepath)
          ? moduleFilepath
          : path.resolve(path.dirname(sourceFile.fileName), moduleFilepath);

        denoTypesComments.push({
          ...comment,
          text,
          module: moduleName,
          filepath: targetFilepath,
          range: Range.create(start, end),
          contentRange: Range.create(moduleNameStart, moduleNameEnd)
        });
      }
    }
  }

  return denoTypesComments;
}

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
    false,
    ts.ScriptKind.TSX
  );

  return getDenoTypesHintsFromSourceFile(sourceFile);
}

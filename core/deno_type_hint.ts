import typescript = require("typescript");

export interface Position {
  line: number;
  character: number;
}

export interface Range {
  start: Position;
  end: Position;
}

export const Position = {
  /**
   * Creates a new Position literal from the given line and character.
   * @param line The position's line.
   * @param character The position's character.
   */
  create(line: number, character: number): Position {
    return { line, character };
  },
};

export const Range = {
  create(start: Position, end: Position): Range {
    return { start, end };
  },
};

export type CompileHint = {
  text: string;
  range: Range;
  contentRange: Range;
};

export function parseCompileHint(
  sourceFile: typescript.SourceFile,
  comment: typescript.CommentRange
): CompileHint | undefined {
  const text = sourceFile.getFullText().substring(comment.pos, comment.end);
  const regexp = /@deno-types=['"]([^'"]+)['"]/;

  const matchers = regexp.exec(text);

  if (!matchers) {
    return;
  }

  const start = sourceFile.getLineAndCharacterOfPosition(comment.pos);
  const end = sourceFile.getLineAndCharacterOfPosition(comment.end);

  const moduleNameStart = Position.create(
    start.line,
    start.character + '// @deno-types="'.length
  );
  const moduleNameEnd = Position.create(end.line, end.character - '"'.length);

  const moduleName = matchers[1];

  return {
    text: moduleName,
    range: Range.create(start, end),
    contentRange: Range.create(moduleNameStart, moduleNameEnd),
  };
}

/**
 * Get Deno compile hint from a source file
 * @param ts
 */
export function getDenoCompileHint(ts: typeof typescript) {
  return function (sourceFile: typescript.SourceFile, pos = 0): CompileHint[] {
    const denoTypesComments: CompileHint[] = [];

    const comments =
      ts.getLeadingCommentRanges(sourceFile.getFullText(), pos) || [];

    for (const comment of comments) {
      if (comment.hasTrailingNewLine) {
        const text = sourceFile
          .getFullText()
          .substring(comment.pos, comment.end);
        const regexp = /@deno-types=['"]([^'"]+)['"]/;

        const matchers = regexp.exec(text);

        if (matchers) {
          const compileHint = parseCompileHint(sourceFile, comment);

          /* istanbul ignore else */
          if (compileHint) {
            denoTypesComments.push(compileHint);
          }
        }
      }
    }

    return denoTypesComments;
  };
}

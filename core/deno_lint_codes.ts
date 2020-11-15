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

export type LintCode = {
  code: string;
  range: Range;
};

export function parseLintIgnores(
  sourceFile: typescript.SourceFile,
  comment: typescript.CommentRange
): LintCode[] | undefined {
  const res: LintCode[] = [];

  const text = sourceFile.getFullText().substring(comment.pos, comment.end);
  const regexp = /deno-lint-ignore(?<file>-file)?(?<codes>(\s+[a-z-]+)*)/;

  const matchers = regexp.exec(text);

  if (!matchers || !matchers.groups) {
    return;
  }

  const start = sourceFile.getLineAndCharacterOfPosition(comment.pos);

  let currentChar =
    start.character +
    "// deno-lint-ignore".length +
    (matchers.groups.file?.length ?? 0);

  const codes = matchers.groups.codes.split(" ");
  currentChar -= 1;
  for (const code of codes) {
    currentChar += 1;
    const startChar = currentChar + (code.length - code.trimLeft().length);
    const endChar = currentChar + code.length;
    currentChar = endChar;

    if (startChar != endChar) {
      const codeStart = Position.create(start.line, startChar);
      const codeEnd = Position.create(start.line, endChar);

      res.push({
        code,
        range: Range.create(codeStart, codeEnd),
      });
    }
  }

  return res;
}

/**
 * Get Deno compile hint from a source file
 * @param ts
 */
export function getLintCodes(ts: typeof typescript) {
  return function (sourceFile: typescript.SourceFile): LintCode[] {
    const lintRules: LintCode[] = [];

    const text = sourceFile.getFullText();

    ts.forEachChild(sourceFile, (node) => {
      const comments =
        ts.getLeadingCommentRanges(text, node.getFullStart()) || [];
      for (const comment of comments) {
        if (comment.hasTrailingNewLine) {
          const lintCodes = parseLintIgnores(sourceFile, comment);
          if (lintCodes) {
            lintRules.push(...lintCodes);
          }
        }
      }
    });

    return lintRules;
  };
}

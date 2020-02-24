import * as path from "path";
import typescript = require("typescript");

interface CommentRange extends typescript.CommentRange {
  text: string;
  module: string;
  filepath: string;
  range: IRange;
  contentRange: IRange;
}

export interface IPosition {
  line: number;
  character: number;
}

export interface IRange {
  start: IPosition;
  end: IPosition;
}

export const Position = {
  /**
   * Creates a new Position literal from the given line and character.
   * @param line The position's line.
   * @param character The position's character.
   */
  create(line: number, character: number): IPosition {
    return { line, character };
  }
};

export const Range = {
  create(start: IPosition, end: IPosition): IRange {
    return { start, end };
  }
};

/**
 * Get Deno compile hint from a source file
 * @param ts
 */
export function getDenoCompileHint(ts: typeof typescript) {
  return function(sourceFile: typescript.SourceFile) {
    const denoTypesComments: CommentRange[] = [];

    const comments =
      ts.getLeadingCommentRanges(sourceFile.getFullText(), 0) || [];

    for (const comment of comments) {
      if (comment.hasTrailingNewLine) {
        const text = sourceFile
          .getFullText()
          .substring(comment.pos, comment.end);
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
  };
}

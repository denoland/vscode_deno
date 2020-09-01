import { promises as fs } from "fs";
import * as path from "path";

type ExpressionFunc = (filepath: string) => boolean;
type Expression = string | RegExp | ExpressionFunc;

type FileWalkerOptions = {
  include?: Expression[];
  exclude?: Expression[];
};

function isMatchExpression(
  filepath: string,
  expressions: Expression[]
): boolean {
  const filename = path.basename(filepath);
  for (const expression of expressions) {
    if (typeof expression === "string" && expression === filename) {
      return true;
    } else if (expression instanceof RegExp && expression.test(filename)) {
      return true;
    } else if (typeof expression === "function" && expression(filepath)) {
      return true;
    }
  }

  return false;
}

export class FileWalker {
  static create(folder: string, options: FileWalkerOptions = {}): FileWalker {
    return new FileWalker(folder, options);
  }
  private constructor(
    private root: string,
    private options: FileWalkerOptions
  ) {}
  async *[Symbol.asyncIterator](): AsyncIterator<string> {
    let files = (await fs.readdir(this.root)).map((filename) =>
      path.join(this.root, filename)
    );

    while (files.length) {
      const filepath = files.shift() as string;

      if (this.options.exclude) {
        if (isMatchExpression(filepath, this.options.exclude)) {
          continue;
        }
      }

      const stat = await fs.stat(filepath);

      if (stat.isDirectory()) {
        files = files.concat(
          (await fs.readdir(filepath)).map((v) => path.join(filepath, v))
        );

        continue;
      }

      if (this.options.include) {
        if (!isMatchExpression(filepath, this.options.include)) {
          continue;
        }
      }

      yield filepath;
    }
  }
}

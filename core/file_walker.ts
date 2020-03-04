import { promises as fs } from "fs";
import * as path from "path";

type Expression = string | RegExp;

type FileWalkerOptions = {
  include?: Expression[];
  exclude?: Expression[];
};

function isMatchExpression(input: string, expressions: Expression[]): boolean {
  for (const expression of expressions) {
    if (typeof expression === "string" && expression === input) {
      return true;
    } else if (expression instanceof RegExp && expression.test(input)) {
      return true;
    }
  }

  return false;
}

export class FileWalker {
  static create(folder: string, options: FileWalkerOptions = {}) {
    return new FileWalker(folder, options);
  }
  constructor(private root: string, private options: FileWalkerOptions) {}
  async *[Symbol.asyncIterator]() {
    let files = (await fs.readdir(this.root)).map(filename =>
      path.join(this.root, filename)
    );

    while (files.length) {
      const file = files.shift() as string;
      const filename = path.basename(file);

      if (this.options.exclude) {
        if (isMatchExpression(filename, this.options.exclude)) {
          continue;
        }
      }

      const stat = await fs.stat(file);

      if (stat.isDirectory()) {
        files = files.concat(
          (await fs.readdir(file)).map(v => path.join(file, v))
        );

        continue;
      }

      if (this.options.include) {
        if (!isMatchExpression(filename, this.options.include)) {
          continue;
        }
      }

      yield file;
    }
  }
}

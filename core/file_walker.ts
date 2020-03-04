import { promises as fs } from "fs";
import * as path from "path";

type FileWalkerOptions = {
  extensionName?: string[];
  exclude?: string[];
};

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

      if ((this.options.exclude || []).includes(filename)) {
        continue;
      }

      const stat = await fs.stat(file);

      if (stat.isDirectory()) {
        files = files.concat(
          (await fs.readdir(file)).map(v => path.join(file, v))
        );
      }

      if (this.options.extensionName) {
        if (this.options.extensionName.includes(path.extname(file))) {
          yield file;
        }
      } else {
        yield file;
      }
    }
  }
}

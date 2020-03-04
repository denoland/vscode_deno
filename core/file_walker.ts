import * as fs from "fs";
import * as path from "path";

export class FileWalker {
  static create(folder: string) {
    return new FileWalker(folder);
  }
  constructor(private root: string) {}
  // TODO: make it to async generator
  *generator() {
    let files = fs
      .readdirSync(this.root)
      .map(filename => path.join(this.root, filename));

    while (files.length) {
      const file = files.shift() as string;
      const filename = path.basename(file);

      if (filename === "node_modules") {
        continue;
      }

      const stat = fs.statSync(file);

      if (stat.isDirectory()) {
        files = files.concat(fs.readdirSync(file).map(v => path.join(file, v)));
      }

      if (file.endsWith(".ts")) {
        yield file;
      }
    }
  }
  [Symbol.iterator](): Iterator<string> {
    const files = fs
      .readdirSync(this.root)
      .map(filename => path.join(this.root, filename));

    return {
      next: () => {
        if (!files.length) {
          return {
            value: "",
            done: true
          };
        }

        const file = files.shift() as string;

        return {
          value: file,
          done: false
        };
      }
    };
  }
}

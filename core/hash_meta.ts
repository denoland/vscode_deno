import * as fs from "fs";
import * as path from "path";

import { pathExistsSync, normalizeFilepath } from "./util";
import { Extension } from "./extension";

type HTTPHeaders = { [key: string]: string };

type MetaFileContent = {
  url: string;
  headers: HTTPHeaders;
};

export enum Type {
  JavaScript = "javascript",
  JavaScriptReact = "javascriptreact",
  TypeScript = "typescript",
  TypeScriptReact = "typescriptreact",
  WebAssembly = "WebAssembly",
  PlainText = "plaintext",
}

interface HashMetaInterface {
  filepath: string; // the filepath of this meta file
  destinationFilepath: string; // the file that this meta file provide
  url: URL;
  headers: HTTPHeaders;
  type: Type;
}

const extNameMap: { [key: string]: Type } = {
  ".ts": Type.TypeScript,
  ".tsx": Type.TypeScriptReact,
  ".js": Type.JavaScript,
  ".jsx": Type.JavaScriptReact,
  ".mjs": Type.JavaScript,
  ".wasm": Type.WebAssembly,
};

const contentTypeMap: [string[], Type][] = [
  [
    ["text/typescript", "application/typescript", "application/x-typescript"],
    Type.TypeScript,
  ],
  [
    [
      "text/javascript",
      "application/javascript",
      "application/x-javascript",
      "text/ecmascript",
      "application/ecmascript",
      "text/jscript",
    ],
    Type.JavaScript,
  ],
  [["application/wasm"], Type.WebAssembly],
];

export class HashMeta implements HashMetaInterface {
  static create(metaFilepath: string): HashMeta | void {
    metaFilepath = normalizeFilepath(metaFilepath);
    if (!pathExistsSync(metaFilepath)) {
      return;
    }
    const metaMap: MetaFileContent = JSON.parse(
      fs.readFileSync(metaFilepath, { encoding: "utf8" })
    );

    if (!metaMap.url || !metaMap.headers) {
      return;
    }

    return new HashMeta(metaFilepath, new URL(metaMap.url), metaMap.headers);
  }
  private constructor(
    public filepath: string,
    public url: URL,
    public headers: HTTPHeaders
  ) {}
  get type(): Type {
    const extname = path.posix.extname(this.url.pathname);

    if (extname && extNameMap[extname]) {
      return extNameMap[extname];
    }

    const contentType = (this.headers["content-type"] || "").toLowerCase();

    // ref: https://mathiasbynens.be/demo/javascript-mime-type
    if (contentType) {
      for (const [contentTypes, type] of contentTypeMap) {
        // text/javascript;charset=UTF-8
        const arr = contentType.split(";");
        for (const _contentType of arr) {
          if (contentTypes.includes(_contentType.toLowerCase())) {
            return type;
          }
        }
      }
    }

    return Type.PlainText;
  }
  get extension(): Extension {
    const type = this.type;

    switch (type) {
      case Type.JavaScript:
        return ".js";
      /* istanbul ignore next */
      case Type.JavaScriptReact:
        return ".jsx";
      case Type.TypeScript:
        if (this.url.pathname.endsWith(".d.ts")) {
          return ".d.ts";
        }
        return ".ts";
      /* istanbul ignore next */
      case Type.TypeScriptReact:
        return ".tsx";
      /* istanbul ignore next */
      case Type.WebAssembly:
        return ".wasm";
    }

    return "";
  }
  get destinationFilepath(): string {
    return this.filepath.replace(/\.metadata\.json$/, "");
  }
}

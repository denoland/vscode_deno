import * as fs from "fs";

import { pathExistsSync } from "./util";

type HTTPHeaders = { [key: string]: string };

type MetaFileContent = {
  url: string;
  headers: HTTPHeaders;
};

export enum Type {
  JavaScript = "javascript",
  TypeScript = "typescript",
  JSON = "json",
  WebAssembly = "WebAssembly",
  PlainText = "plaintext"
}

interface HashMetaInterface {
  filepath: string; // the filepath of this meta file
  destinationFilepath: string; // the file that this meta file provide
  url: URL;
  headers: HTTPHeaders;
  type: Type;
}

export class HashMeta implements HashMetaInterface {
  static create(metaFilepath: string): HashMeta | void {
    if (!pathExistsSync(metaFilepath)) {
      return;
    }
    const metaMap: MetaFileContent = JSON.parse(
      fs.readFileSync(metaFilepath, { encoding: "utf8" })
    );

    return new HashMeta(metaFilepath, new URL(metaMap.url), metaMap.headers);
  }
  constructor(
    public filepath: string,
    public url: URL,
    public headers: HTTPHeaders
  ) {}
  get type(): Type {
    if (/\.tsx?/.test(this.url.pathname)) {
      return Type.TypeScript;
    }
    if (/\.jsx?/.test(this.url.pathname)) {
      return Type.JavaScript;
    }
    if (/\.json?/.test(this.url.pathname)) {
      return Type.JSON;
    }
    if (/\.wasm?/.test(this.url.pathname)) {
      return Type.WebAssembly;
    }

    const contentType = this.headers["content-type"];

    if (contentType) {
      if (contentType.indexOf("typescript") >= 0) {
        return Type.TypeScript;
      }
      if (contentType.indexOf("javascript") >= 0) {
        return Type.JavaScript;
      }
      if (contentType.indexOf("json") >= 0) {
        return Type.JSON;
      }
      if (contentType.indexOf("wasm") >= 0) {
        return Type.WebAssembly;
      }
    }

    return Type.PlainText;
  }
  get destinationFilepath(): string {
    return this.filepath.replace(/\.metadata\.json$/, "");
  }
}

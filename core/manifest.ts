import * as path from "path";
import * as fs from "fs";

import { getDenoDepsDir } from "./deno";
import { pathExistsSync, str2regexpStr } from "./util";

type urlPathAndQuerySHA256 = string;

export interface IManifest {
  origin: string;
  filepath: string;
  getHashFromUrlPath(urlPathAndQuery: string): urlPathAndQuerySHA256 | void;
  getUrlPathFromHash(hash: urlPathAndQuerySHA256): string | void;
}

export class Manifest implements IManifest {
  static create(manifestFilepath: string): Manifest | void {
    if (!pathExistsSync(manifestFilepath)) {
      return;
    }
    const manifestMap: { [key: string]: string } = JSON.parse(
      fs.readFileSync(manifestFilepath, { encoding: "utf8" })
    );
    const origin = path
      .dirname(manifestFilepath)
      .replace(new RegExp("^" + str2regexpStr(getDenoDepsDir() + path.sep)), "")
      .replace(new RegExp(str2regexpStr(path.sep), "gm"), "/")
      .replace(/^(https?)\//, "$1://");

    return new Manifest(origin, manifestFilepath, manifestMap);
  }
  constructor(
    public origin: string,
    public filepath: string,
    private map: { [urlPathAndQuery: string]: urlPathAndQuerySHA256 }
  ) {}
  getHashFromUrlPath(urlPathAndQuery: string): urlPathAndQuerySHA256 | void {
    return this.map[urlPathAndQuery];
  }
  getUrlPathFromHash(hash: urlPathAndQuerySHA256): string | void {
    for (const urlPathAndQuery in this.map) {
      const _hash = this.map[urlPathAndQuery];
      if (_hash === hash) {
        return urlPathAndQuery;
      }
    }
    return;
  }
}

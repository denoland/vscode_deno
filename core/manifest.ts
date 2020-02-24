import * as path from "path";
import * as fs from "fs";

import { getDenoDepsDir } from "./deno";
import { pathExistsSync, str2regexpStr } from "./util";

type hash = string;
type iteratorArr = [string, hash];

export interface IManifest {
  origin: string;
  filepath: string;
  getHashFromUrlPath(urlPath: string): hash | void;
  getUrlPathFromHash(hash: hash): string | void;
  [Symbol.iterator](): Iterator<iteratorArr>;
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
    public origin: string, // eg. deno.land
    public filepath: string,
    private map: { [urlPath: string]: hash }
  ) {}
  getHashFromUrlPath(urlPath: string): hash | void {
    return this.map[urlPath];
  }
  getUrlPathFromHash(hash: hash): string | void {
    for (const [urlPath, _hash] of this) {
      if (_hash === hash) {
        return urlPath;
      }
    }
    return;
  }
  [Symbol.iterator](): Iterator<iteratorArr> {
    const keys = Object.keys(this.map);

    let currentIndex = 0;

    return {
      next: () => {
        if (currentIndex === keys.length) {
          return {
            value: [],
            done: true
          };
        }

        const key = keys[currentIndex];
        const value = this.map[key];

        currentIndex++;

        return {
          value: [key, value],
          done: false
        };
      }
    };
  }
}

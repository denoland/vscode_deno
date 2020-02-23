import * as path from "path";
import { URL } from "url";

import { getDenoDepsDir } from "./deno";
import { IManifest, Manifest } from "./manifest";
import { str2regexpStr } from "./util";

export interface DenoCacheModule {
  filepath: string;
  url: string;
  resolveModule(moduleName: string): DenoCacheModule | void;
}

class CacheModule implements DenoCacheModule {
  constructor(
    public filepath: string,
    public url: string,
    private manifest: IManifest
  ) {}
  /**
   * Resolve module in this cache file
   * @param moduleName The module name is for unix style
   */
  resolveModule(moduleName: string) {
    // eg. import "/npm:tough-cookie@3?dew"
    if (moduleName.indexOf("/") === 0) {
      const fileHash = this.manifest.getHashFromUrlPath(moduleName);

      if (!fileHash) {
        return;
      }

      const originDir = path.dirname(this.filepath);
      const targetFilepath = path.join(originDir, fileHash);

      return Cache.create(targetFilepath);
    }
    // eg. import "./sub/mod.ts"
    else if (moduleName.indexOf(".") === 0) {
      const originDir = path.dirname(this.filepath);
      const currentUrlPath = new URL(this.url);

      const targetUrlPath = path.posix.resolve(
        path.posix.dirname(currentUrlPath.pathname),
        moduleName
      );
      const fileHash = this.manifest.getHashFromUrlPath(targetUrlPath);

      // if file hash not exist. then module not found.
      if (!fileHash) {
        return;
      }

      const targetFilepath = path.join(originDir, fileHash);

      return Cache.create(targetFilepath);
    }
    // eg import "https://example.com/demo/mod.ts"
    else if (/http?s:\/\//.test(moduleName)) {
      const url = new URL(moduleName);
      const targetOriginDir = path.join(
        getDenoDepsDir(),
        url.protocol.replace(/:$/, ""), // https: -> https
        url.hostname
      );

      const manifest = Manifest.create(
        path.join(targetOriginDir, "manifest.json")
      );

      if (!manifest) {
        return;
      }

      const hash = manifest.getHashFromUrlPath(url.pathname);

      if (!hash) {
        return;
      }

      return Cache.create(path.join(targetOriginDir, hash));
    }
  }
}

export class Cache {
  static create(filepath: string): DenoCacheModule | void {
    const DENO_DEPS_DIR = getDenoDepsDir();
    // if not a Deno deps module
    if (filepath.indexOf(DENO_DEPS_DIR) !== 0) {
      return;
    }

    const hash = path.basename(filepath);
    const originDir = path.dirname(filepath);
    const manifestFilepath = path.join(originDir, "manifest.json");
    // $DENO_DIR/deps/https/deno.land -> https://deno.land
    const origin = originDir
      .replace(new RegExp("^" + str2regexpStr(DENO_DEPS_DIR + path.sep)), "")
      .replace(new RegExp(str2regexpStr(path.sep), "gm"), "/")
      .replace(/^(https?)\//, "$1://");

    const manifest = Manifest.create(manifestFilepath);

    if (!manifest) {
      return;
    }

    const urlPathAndQuery = manifest.getUrlPathFromHash(hash);

    if (!urlPathAndQuery) {
      return;
    }

    const url = origin + urlPathAndQuery;
    return new CacheModule(filepath, url, manifest);
  }
}

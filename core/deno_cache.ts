import * as path from "path";
import { URL } from "url";
import assert from "assert";

import { getDenoDepsDir } from "./deno";
import { HashMeta } from "./hash_meta";
import { pathExistsSync, isHttpURL, hashURL, normalizeFilepath } from "./util";
import { Logger } from "./logger";
import { Extension } from "./extension";

export interface DenoCacheModule {
  filepath: string;
  extension: Extension;
  meta: HashMeta;
  resolveModule(moduleName: string): DenoCacheModule | void;
}

export class CacheModule implements DenoCacheModule {
  static create(filepath: string, logger?: Logger): DenoCacheModule | void {
    filepath = normalizeFilepath(filepath);

    if (!pathExistsSync(filepath)) {
      return;
    }

    const DENO_DEPS_DIR = getDenoDepsDir();
    // if not a Deno deps module
    if (filepath.indexOf(DENO_DEPS_DIR) !== 0) {
      return;
    }

    const hash = path.basename(filepath);
    const originDir = path.dirname(filepath);
    const metaFilepath = path.join(originDir, `${hash}.metadata.json`);

    const meta = HashMeta.create(metaFilepath);

    if (!meta) {
      return;
    }

    return new CacheModule(filepath, meta, meta.extension, logger);
  }

  private constructor(
    public filepath: string,
    public meta: HashMeta,
    public extension: Extension,
    private logger?: Logger
  ) {
    filepath = normalizeFilepath(filepath);
    assert(
      path.isAbsolute(filepath),
      `Deno Module filepath require absolute but got ${filepath}`
    );
  }
  private tryRedirect(meta: HashMeta): DenoCacheModule | void | null {
    const redirect = meta.headers["location"];

    if (redirect) {
      let redirectUrl: string;
      // eg: https://redirect.com/path/to/redirect
      if (isHttpURL(redirect)) {
        redirectUrl = redirect;
      }
      // eg: /path/to/redirect
      else if (redirect.startsWith("/")) {
        redirectUrl = `${meta.url.protocol}//${meta.url.host}${redirect}`;
      }
      // eg: ./path/to/redirect
      else if (redirect.startsWith("./") || redirect.startsWith("../")) {
        redirectUrl = `${meta.url.protocol}//${
          meta.url.host
        }${path.posix.resolve(meta.url.pathname, redirect)}`;
      }
      // invalid
      else {
        return;
      }

      // if circle import
      if (redirectUrl === meta.url.href) {
        return null;
      }

      return this.resolveModule(redirectUrl);
    }
  }
  private tryResolveXTypescriptTypes(meta: HashMeta): DenoCacheModule | void {
    const typescriptTypes = meta.headers["x-typescript-types"];

    if (typescriptTypes) {
      return this.resolveModule(typescriptTypes);
    }
  }
  /**
   * Resolve module in this cache file
   * @param moduleName The module name is for unix style
   */
  resolveModule(moduleName: string): DenoCacheModule | void {
    /* istanbul ignore next */
    this.logger?.info(`resolve module ${moduleName} from ${this.meta.url}`);

    let url: URL;
    let targetOriginDir: string = path.dirname(this.filepath);

    // eg: /path/to/redirect
    if (moduleName.startsWith("/")) {
      url = new URL(this.meta.url.origin + moduleName);
      targetOriginDir = path.dirname(this.filepath);
    }
    // eg: ./path/to/redirect
    else if (moduleName.startsWith("./") || moduleName.startsWith("../")) {
      const targetUrlPath = path.posix.resolve(
        path.posix.dirname(this.meta.url.pathname),
        moduleName
      );

      url = new URL(this.meta.url.origin + targetUrlPath);
      targetOriginDir = path.dirname(this.filepath);
    }
    // eg: https://redirect.com/path/to/redirect
    else if (isHttpURL(moduleName)) {
      url = new URL(moduleName);
      targetOriginDir = path.join(
        getDenoDepsDir(),
        url.protocol.replace(/:$/, ""), // https: -> https
        url.hostname
      );
    }
    // invalid
    else {
      return;
    }

    const hash = hashURL(url);

    const moduleCacheFilepath = path.join(targetOriginDir, hash);

    if (!pathExistsSync(moduleCacheFilepath)) {
      return;
    }

    const moduleMetaFilepath = moduleCacheFilepath + ".metadata.json";

    const meta = HashMeta.create(moduleMetaFilepath);

    if (!meta) {
      return;
    }

    const redirectCache = this.tryRedirect(meta);

    if (redirectCache) {
      return redirectCache;
    } else if (redirectCache === null) {
      return;
    }

    const typeCache = this.tryResolveXTypescriptTypes(meta);

    if (typeCache) {
      return typeCache;
    }

    return CacheModule.create(moduleCacheFilepath, this.logger);
  }
}

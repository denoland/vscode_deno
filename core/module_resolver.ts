import { URL } from "url";
import * as path from "path";
import assert from "assert";

import { getDenoDepsDir } from "./deno";
import { CacheModule, DenoCacheModule } from "./deno_cache";
import { ImportMap } from "./import_map";
import { HashMeta } from "./hash_meta";
import { pathExistsSync, isHttpURL, hashURL, normalizeFilepath } from "./util";
import { Logger } from "./logger";
import { Extension, getExtensionFromFile } from "./extension";

export type ResolvedModule = {
  origin: string; // the origin resolve module
  filepath: string; // full file name path. May be relative or absolute
  module: string; // final resolve module. It may not have an extension
  extension: Extension;
};

export interface ModuleResolverInterface {
  resolveModules(moduleNames: string[]): (ResolvedModule | void)[];
}

export class ModuleResolver implements ModuleResolverInterface {
  private importMaps = ImportMap.create(this.importMapsFile);

  private denoCacheFile?: DenoCacheModule;

  /**
   * Module resolver constructor
   * @param containingFile Absolute file path
   * @param importMapsFile Absolute file path
   */
  constructor(
    private containingFile: string,
    private importMapsFile?: string,
    private logger?: Logger
  ) {
    containingFile = normalizeFilepath(containingFile);
    if (importMapsFile) {
      this.importMapsFile = normalizeFilepath(importMapsFile);
    }
    assert(
      path.isAbsolute(containingFile),
      `ModuleResolver filepath require absolute but got ${containingFile}`
    );

    this.denoCacheFile = CacheModule.create(
      this.containingFile
    ) as DenoCacheModule;
  }

  /**
   * Create a module resolver.
   * @param containingFile Absolute file path
   * @param importMapsFile Absolute file path
   */
  static create(
    containingFile: string,
    importMapsFile?: string,
    logger?: Logger
  ): ModuleResolver {
    return new ModuleResolver(containingFile, importMapsFile, logger);
  }

  private resolveFromRemote(
    httpModuleURL: string,
    origin: string
  ): ResolvedModule | undefined {
    const url = new URL(httpModuleURL);

    const originDir = path.join(
      getDenoDepsDir(),
      url.protocol.replace(/:$/, ""), // https: -> https
      url.hostname
    );

    const hash = hashURL(url);

    const metaFilepath = path.join(originDir, `${hash}.metadata.json`);

    const meta = HashMeta.create(metaFilepath);

    if (!meta) {
      return;
    }

    let redirect = meta.headers["location"];

    if (redirect) {
      redirect = isHttpURL(redirect) // eg: https://redirect.com/path/to/redirect
        ? redirect
        : path.posix.isAbsolute(redirect) // eg: /path/to/redirect
        ? `${url.protocol}//${url.host}${redirect}`
        : // eg: ./path/to/redirect
          `${url.protocol}//${url.host}${path.posix.resolve(
            url.pathname,
            redirect
          )}`;

      if (!isHttpURL(redirect) || redirect === httpModuleURL) {
        return;
      }

      return this.resolveFromRemote(redirect, origin);
    }

    const moduleFilepath = path.join(originDir, hash);

    const typescriptTypes = meta.headers["x-typescript-types"];
    if (typescriptTypes) {
      const resolver = ModuleResolver.create(
        moduleFilepath,
        this.importMapsFile
      );
      const [typeModule] = resolver.resolveModules([typescriptTypes]);

      /* istanbul ignore else */
      if (typeModule) {
        typeModule.origin = httpModuleURL;
      }

      return typeModule;
    }

    return {
      origin: origin,
      filepath: moduleFilepath,
      module: moduleFilepath,
      extension: meta.extension,
    };
  }

  private resolveFromLocal(moduleName: string): ResolvedModule | undefined {
    const originModuleName = moduleName;
    moduleName = this.importMaps.resolveModule(moduleName);

    if (isHttpURL(moduleName)) {
      return this.resolveFromRemote(moduleName, originModuleName);
    }

    const moduleFilepath = path.resolve(
      path.dirname(this.containingFile),
      normalizeFilepath(moduleName)
    );

    if (!pathExistsSync(moduleFilepath)) {
      return;
    }

    return {
      origin: originModuleName,
      filepath: moduleFilepath,
      module: moduleFilepath.replace(/(\.d)?\.(t|j)sx?$/, ""), // "./foo.ts" -> "./foo",
      extension: getExtensionFromFile(moduleFilepath),
    };
  }

  /**
   * Find cached modules in the file.
   * If cannot found module, returns undefined
   * @param moduleNames Module name is always unix style.
   *                    eg `./foo.ts`
   *                       `/std/path/mod.ts`
   *                       `https://deno.land/std/path/mod.ts`
   */
  resolveModules(moduleNames: string[]): (ResolvedModule | undefined)[] {
    const resolvedModules: (ResolvedModule | undefined)[] = [];

    for (const moduleName of moduleNames) {
      /* istanbul ignore next */
      this.logger?.info(
        `resolve module ${moduleName} from ${this.containingFile}`
      );
      // If the file is in Deno's cache layout
      // Then we should look up from the cache
      if (this.denoCacheFile) {
        const moduleCacheFile = this.denoCacheFile.resolveModule(moduleName);

        if (moduleCacheFile) {
          resolvedModules.push({
            origin: moduleName,
            filepath: moduleCacheFile.filepath,
            module: moduleCacheFile.filepath,
            extension: moduleCacheFile.extension,
          });
        } else {
          resolvedModules.push(undefined);
        }

        continue;
      }

      // If import from remote
      if (isHttpURL(moduleName)) {
        resolvedModules.push(this.resolveFromRemote(moduleName, moduleName));
        continue;
      }

      // The rest are importing local modules
      // eg.
      // `./foo.ts`
      // `../foo/bar.ts`
      resolvedModules.push(this.resolveFromLocal(moduleName));
    }

    return resolvedModules;
  }
}

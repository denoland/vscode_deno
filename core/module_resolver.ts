import { URL } from "url";
import * as path from "path";
import assert from "assert";

import { getDenoDepsDir } from "./deno";
import { CacheModule, DenoCacheModule } from "./deno_cache";
import { ImportMap } from "./import_map";
import { HashMeta } from "./hash_meta";
import { pathExistsSync, isHttpURL, hashURL, normalizeFilepath } from "./util";
import { Logger } from "./logger";

export type ResolvedModule = {
  origin: string; // the origin resolve module
  filepath: string; // full file name path. May be relative or absolute
  module: string; // final resolve module. It may not have an extension
};

export interface ModuleResolverInterface {
  resolveModules(moduleNames: string[]): (ResolvedModule | void)[];
}

export class ModuleResolver implements ModuleResolverInterface {
  // Whether the file is a cache file for Deno
  private isDenoCacheFile: boolean =
    this.containingFile.indexOf(getDenoDepsDir()) === 0; // Whether the current module is in the Deno dependency directory

  private importMaps = ImportMap.create(this.importMapsFile);

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
    importMapsFile = normalizeFilepath(importMapsFile);
    assert(
      path.isAbsolute(containingFile),
      `ModuleResolver filepath require absolute but got ${containingFile}`
    );
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

  private resolveFromRemote(httpModuleURL: string): ResolvedModule | undefined {
    let url: URL;

    try {
      url = new URL(httpModuleURL);
    } catch {
      // If the URL is invalid, we consider this module to not exist
      return;
    }

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

    const redirect = meta.headers["location"];

    if (redirect && redirect !== httpModuleURL) {
      return this.resolveFromRemote(redirect);
    }

    const moduleFilepath = path.join(originDir, hash);

    const typescriptTypes = meta.headers["x-typescript-types"];
    if (typescriptTypes) {
      const resolver = ModuleResolver.create(
        moduleFilepath,
        this.importMapsFile
      );
      const [typeModule] = resolver.resolveModules([typescriptTypes]);

      return typeModule;
    }

    return {
      origin: httpModuleURL,
      filepath: moduleFilepath,
      module: moduleFilepath
    };
  }

  private resolveFromLocal(moduleName: string): ResolvedModule | undefined {
    const originModuleName = moduleName;
    moduleName = this.importMaps.resolveModule(moduleName);

    if (isHttpURL(moduleName)) {
      return this.resolveFromRemote(moduleName);
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
      module: moduleFilepath.replace(/(\.d)?\.(t|j)sx?$/, "") // "./foo.ts" -> "./foo"
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

    let denoCacheFile: DenoCacheModule | undefined = undefined;

    if (this.isDenoCacheFile) {
      denoCacheFile = CacheModule.create(
        this.containingFile
      ) as DenoCacheModule;

      // if cache file not found
      if (!denoCacheFile) {
        return new Array(moduleNames.length).fill(undefined);
      }
    }

    for (const moduleName of moduleNames) {
      const originModuleName = moduleName;
      // If the file is in Deno's cache layout
      // Then we should look up from the cache
      if (this.isDenoCacheFile && denoCacheFile) {
        const moduleCacheFile = denoCacheFile.resolveModule(moduleName);

        if (moduleCacheFile) {
          resolvedModules.push({
            origin: originModuleName,
            filepath: moduleCacheFile.filepath,
            module: moduleCacheFile.filepath
          });
        } else {
          resolvedModules.push(undefined);
        }

        continue;
      }

      // If import from remote
      if (isHttpURL(moduleName)) {
        resolvedModules.push(this.resolveFromRemote(moduleName));
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

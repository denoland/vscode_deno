import { URL } from "url";
import * as path from "path";
import assert from "assert";

import { getDenoDepsDir } from "./deno";
import { Cache, DenoCacheModule } from "./deno_cache";
import { Manifest } from "./manifest";
import { ImportMap } from "./import_map";

export type ResolvedModule = {
  origin: string; // the origin resolve module
  filepath: string; // full file name path. May be relative or absolute
  module: string; // final resolve module. It may not have an extension
};

export class ModuleResolver {
  // Whether the file is a cache file for Deno
  private isDenoCacheFile: boolean =
    this.containingFile.indexOf(getDenoDepsDir()) === 0; // Whether the current module is in the Deno dependency directory

  private importMaps = ImportMap.createSync(this.importMapsFile);

  /**
   * Module resolver constructor
   * @param containingFile Absolute file path
   * @param importMapsFile Absolute file path
   */
  constructor(private containingFile: string, private importMapsFile?: string) {
    assert(path.isAbsolute(containingFile));
  }

  /**
   * Create a module resolver.
   * @param containingFile Absolute file path
   * @param importMapsFile Absolute file path
   */
  static create(
    containingFile: string,
    importMapsFile?: string
  ): ModuleResolver {
    return new ModuleResolver(containingFile, importMapsFile);
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

    const manifest = Manifest.create(path.join(originDir, "manifest.json"));

    if (!manifest) {
      return;
    }

    const hash = manifest.getHashFromUrlPath(url.pathname + url.search);

    if (!hash) {
      return;
    }

    const moduleFilepath = path.join(originDir, hash);

    return {
      origin: httpModuleURL,
      filepath: moduleFilepath,
      module: moduleFilepath
    };
  }

  private resolveFromLocal(moduleName: string): ResolvedModule | undefined {
    const originModuleName = moduleName;
    for (const prefix in this.importMaps.imports) {
      const mapModule = this.importMaps.imports[prefix];

      const reg = new RegExp("^" + prefix);
      if (reg.test(moduleName)) {
        moduleName = moduleName.replace(reg, mapModule);

        if (/^https?:\/\//.test(moduleName)) {
          return this.resolveFromRemote(moduleName);
        }
      }
    }

    const moduleFilepath = path.resolve(
      path.dirname(this.containingFile),
      moduleName
    );

    return {
      origin: originModuleName,
      filepath: moduleFilepath,
      module: moduleFilepath.replace(/(\.d)?\.(t|j)sx?$/, "") // "./foo.ts" -> "./foo"
    };
  }

  /**
   * Find modules in the file.
   * If cannot found module, returns undefined
   * @param moduleNames Module name is always unix style.
   *                    eg `./foo.ts`
   *                       `/std/path/mod.ts`
   *                       `https://deno.land/std/path/mod.ts`
   */
  resolveModules(moduleNames: string[]): (ResolvedModule | void)[] {
    const resolvedModules: (ResolvedModule | void)[] = [];

    let denoCacheFile: DenoCacheModule;

    if (this.isDenoCacheFile) {
      denoCacheFile = Cache.create(this.containingFile) as DenoCacheModule;

      // if cache file not found
      if (!denoCacheFile) {
        return new Array(moduleNames.length).fill(undefined);
      }
    }

    for (let moduleName of moduleNames) {
      const originModuleName = moduleName;
      // If the file is in Deno's cache layout
      // Then we should look up from the cache
      if (this.isDenoCacheFile) {
        const moduleCacheFile = denoCacheFile!.resolveModule(moduleName);

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
      if (/^https?:\/\//.test(moduleName)) {
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

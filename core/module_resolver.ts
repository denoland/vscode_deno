import { URL } from "url";
import * as path from "path";

import { getDenoDepsDir } from "./deno";
import { Cache, DenoCacheModule } from "./deno_cache";
import { Manifest } from "./manifest";

export type ResolvedModule = {
  origin: string; // the origin resolve module
  filepath: string; // full file name path. May be relative or absolute
  module: string; // final resolve module. It may not have an extension
};

export class ModuleResolver {
  // Whether the file is a cache file for Deno
  private isDenoCacheFile: boolean =
    this.containingFile.indexOf(getDenoDepsDir()) === 0; // Whether the current module is in the Deno dependency directory

  constructor(private containingFile: string) {}

  /**
   * Create a module resolver.
   * @param containingFile Absolute file path
   */
  static create(containingFile: string): ModuleResolver {
    return new ModuleResolver(containingFile);
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

    for (const moduleName of moduleNames) {
      // If the file is in Deno's cache layout
      // Then we should look up from the cache
      if (this.isDenoCacheFile) {
        const moduleCacheFile = denoCacheFile!.resolveModule(moduleName);

        if (moduleCacheFile) {
          resolvedModules.push({
            origin: moduleName,
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
        let url: URL;

        try {
          url = new URL(moduleName);
        } catch {
          // If the URL is invalid, we consider this module to not exist
          resolvedModules.push(undefined);

          continue;
        }

        const originDir = path.join(
          getDenoDepsDir(),
          url.protocol.replace(/:$/, ""), // https: -> https
          url.hostname
        );

        const manifest = Manifest.create(path.join(originDir, "manifest.json"));

        if (!manifest) {
          resolvedModules.push(undefined);
          continue;
        }

        const hash = manifest.getHashFromUrlPath(url.pathname);

        if (!hash) {
          resolvedModules.push(undefined);
          continue;
        }

        const moduleFilepath = path.join(originDir, hash);

        resolvedModules.push({
          origin: moduleName,
          filepath: moduleFilepath,
          module: moduleFilepath
        });

        continue;
      }

      // The rest are importing local modules
      // eg.
      // `./foo.ts`
      // `../foo/bar.ts`
      // TODO: handle for Import Maps
      const moduleFilepath = path.resolve(
        path.dirname(this.containingFile),
        moduleName
      );

      resolvedModules.push({
        origin: moduleName,
        filepath: moduleFilepath,
        module: moduleFilepath.replace(/(\.d)?\.(t|j)sx?$/, "") // "./foo.ts" -> "./foo"
      });
    }

    return resolvedModules;
  }
}

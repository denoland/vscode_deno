import * as path from "path";
import { promises as fs } from "fs";

import { getDenoDepsDir } from "./deno";
import { Manifest } from "./manifest";

export type Deps = {
  url: string;
  filepath: string;
};

/**
 * Get cached dependency files
 * @param depsRootDir
 * @param deps
 */
export async function getDenoDeps(
  depsRootDir = getDenoDepsDir(),
  deps: Deps[] = []
): Promise<Deps[]> {
  const protocols = await fs.readdir(depsRootDir);

  for (const protocol of protocols) {
    const protocolFolderpath = path.join(depsRootDir, protocol);
    const origins = await fs.readdir(protocolFolderpath);

    for (const origin of origins) {
      const originFolderpath = path.join(protocolFolderpath, origin);
      const manifestFilepath = path.join(originFolderpath, "manifest.json");

      const manifest = Manifest.create(manifestFilepath);

      if (manifest) {
        for (const [urlPath, hash] of manifest) {
          const url = manifest.origin + urlPath;
          const filepath = path.join(originFolderpath, hash);
          deps.push({
            url,
            filepath
          });
        }
      }
    }
  }

  return deps;
}

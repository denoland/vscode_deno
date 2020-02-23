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
 */
export async function getDenoDeps(): Promise<Deps[]> {
  const depsRootDir = getDenoDepsDir();
  const deps: Deps[] = [];
  const protocols = await fs.readdir(depsRootDir);

  await Promise.all([
    protocols.map(async protocol => {
      const protocolFolderpath = path.join(depsRootDir, protocol);
      const protocolStat = await fs.stat(protocolFolderpath);

      if (protocolStat.isDirectory()) {
        const origins = await fs.readdir(protocolFolderpath);

        await Promise.all([
          origins.map(async origin => {
            const originFolderpath = path.join(protocolFolderpath, origin);
            const manifestFilepath = path.join(
              originFolderpath,
              "manifest.json"
            );

            const originStat = await fs.stat(originFolderpath);

            if (originStat.isDirectory()) {
              const manifest = Manifest.create(manifestFilepath);

              console.log("main", manifestFilepath);

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
          })
        ]);
      }
    })
  ]);

  return deps;
}

import * as path from "path";
import { promises as fs } from "fs";

import { getDenoDepsDir } from "./deno";
import { HashMeta } from "./hash_meta";

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

  await Promise.all(
    protocols.map(async protocol => {
      const protocolFolderpath = path.join(depsRootDir, protocol);
      const protocolStat = await fs.stat(protocolFolderpath);

      if (protocolStat.isDirectory()) {
        const origins = (await fs.readdir(protocolFolderpath)).map(v =>
          path.join(protocolFolderpath, v)
        );

        await Promise.all(
          origins.map(async origin => {
            const stat = await fs.stat(origin);

            if (!stat.isDirectory()) {
              return;
            }

            const metaFiles = (await fs.readdir(origin))
              .filter(v => v.endsWith(".metadata.json"))
              .map(v => path.join(origin, v));

            for (const metaFile of metaFiles) {
              const meta = HashMeta.create(metaFile);
              if (meta) {
                deps.push({
                  url: meta.url.href,
                  filepath: meta.destinationFilepath
                });
              }
            }
          })
        );
      }
    })
  );

  return deps;
}

import * as path from "path";

import { getDenoDepsDir } from "./deno";
import { CacheModule } from "./deno_cache";

/**
 * Normalize import statement
 * @param importStatement eg. `import { path } from "../../../../Library/Caches/deno/deps/https/example.com/da88efaa8b70cda7903ddc29b8d4c6ea3015de65329ea393289f4104ae2da941"`
 * @returns string eg. `https://example.com/demo/sub/mod.ts`
 */
export function normalizeImportStatement(importStatement: string): string {
  const regexp = /^import\s(.*)\s*from\s*['"]([^'"]+)['"](.*)$/gim;

  const matcher = regexp.exec(importStatement);

  if (matcher) {
    const importModuleNames = matcher[1].trim();
    // relative path is always unix path
    const moduleName = matcher[2];
    const moduleFilepath = moduleName.replace(/\//gm, path.sep);
    const moduleAbsoluteFilepath = path.isAbsolute(moduleFilepath)
      ? moduleFilepath
      : path.resolve(moduleFilepath);
    const rest = matcher[3];

    if (moduleAbsoluteFilepath.indexOf(getDenoDepsDir()) >= 0) {
      const cache = CacheModule.create(moduleAbsoluteFilepath);
      if (cache) {
        importStatement = `import ${importModuleNames} from "${cache.url}"${
          rest ? rest : ""
        }`;
      }
    }
  }

  return importStatement;
}

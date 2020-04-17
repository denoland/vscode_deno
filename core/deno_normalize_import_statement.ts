import * as path from "path";

import { getDenoDepsDir } from "./deno";
import { CacheModule } from "./deno_cache";
import { normalizeFilepath } from "./util";
import { Logger } from "./logger";

/**
 * Normalize import statement
 * @param importStatement eg. `import { path } from "../../../../Library/Caches/deno/deps/https/example.com/da88efaa8b70cda7903ddc29b8d4c6ea3015de65329ea393289f4104ae2da941"`
 * @returns string eg. `https://example.com/demo/sub/mod.ts`
 */
export function normalizeImportStatement(
  filename: string,
  importStatement: string,
  logger?: Logger
): string {
  filename = normalizeFilepath(filename);
  const regexp = /^import\s(.*)\s*from\s*['"]([^'"]+)['"](.*)$/gim;

  const matcher = regexp.exec(importStatement);

  /* istanbul ignore else */
  if (matcher) {
    const importModuleNames = matcher[1].trim();
    // relative path is always unix path
    const moduleName = matcher[2];
    const moduleFilepath = normalizeFilepath(moduleName);
    const moduleAbsoluteFilepath = normalizeFilepath(
      path.isAbsolute(moduleFilepath)
        ? moduleFilepath
        : path.resolve(path.dirname(filename), moduleFilepath)
    );
    const rest = matcher[3];

    /* istanbul ignore next */
    logger?.info(
      `normalize import \`${importStatement}\` in file \`${filename}\` with module \`${moduleAbsoluteFilepath}\``
    );

    /* istanbul ignore else */
    if (moduleAbsoluteFilepath.startsWith(getDenoDepsDir())) {
      const cache = CacheModule.create(moduleAbsoluteFilepath);
      /* istanbul ignore else */
      if (cache) {
        importStatement = `import ${importModuleNames} from "${
          cache.meta.url
        }"${
          /* istanbul ignore next */
          rest ? rest : ""
        }`;
      }
    }
  }

  return importStatement;
}

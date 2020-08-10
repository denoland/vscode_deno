import * as path from "path";
import { readFileSync } from "fs";
import assert from "assert";

import { pathExistsSync, escapeRegExp, normalizeFilepath } from "./util";

export interface ImportMapInterface {
  filepath?: string;
  resolveModule(moduleName: string): string;
  toJSON(): ImportContent;
  [Symbol.iterator](): Iterator<[string, string]>;
}

type ImportFileMapContent = {
  imports: ImportContent;
};

type ImportContent = { [prefix: string]: string };

export class ImportMap implements ImportMapInterface {
  private constructor(
    public map: ImportFileMapContent,
    public filepath?: string
  ) {}
  static create(importMapFilepath?: string): ImportMapInterface {
    let importMap: ImportFileMapContent = {
      imports: {},
    };

    //  try resolve import maps
    if (importMapFilepath) {
      importMapFilepath = normalizeFilepath(importMapFilepath);
      assert(
        path.isAbsolute(importMapFilepath),
        `Import-Map filepath require absolute but got ${importMapFilepath}`
      );

      if (pathExistsSync(importMapFilepath) === true) {
        const importMapContent = readFileSync(importMapFilepath, {
          encoding: "utf8",
        });

        try {
          importMap = JSON.parse(importMapContent || "");

          // Make sure `importMap.imports` is a key-value object
          // Otherwise, an exception may be thrown
          if (
            Object.prototype.toString.call(importMap.imports) !==
            "[object Object]"
          ) {
            importMap.imports = {};
          }
        } catch {
          importMap.imports = {};
        }
      }
    }

    const imports = Object.entries(importMap.imports)
      .filter(
        ([key, val]) =>
          (key.endsWith("/") && val.endsWith("/")) ||
          (!key.endsWith("/") && !val.endsWith("/"))
      )
      .sort(([key1], [key2]) => key2.lastIndexOf("/") - key1.lastIndexOf("/"))
      .reduce((imports, [key, value]) => ({ ...imports, [key]: value }), {});

    importMap.imports = imports;

    return new ImportMap(importMap, importMapFilepath);
  }
  toJSON() {
    return this.map.imports;
  }
  resolveModule(moduleName: string): string {
    for (const [prefix, mapModule] of this) {
      const reg = new RegExp("^" + escapeRegExp(prefix));
      if (reg.test(moduleName)) {
        moduleName = moduleName.replace(reg, mapModule);

        // if module name is a relative path
        if (moduleName.startsWith(".") && this.filepath) {
          moduleName = path.resolve(
            path.dirname(this.filepath),
            normalizeFilepath(moduleName)
          );
        }

        return moduleName;
      }
    }

    return moduleName;
  }
  [Symbol.iterator](): Iterator<[string, string]> {
    const keys = Object.keys(this.map.imports);

    let currentIndex = 0;

    return {
      next: () => {
        if (currentIndex === keys.length) {
          return {
            value: [],
            done: true,
          };
        }

        const key = keys[currentIndex];
        const value = this.map.imports[key];

        currentIndex++;

        return {
          value: [key, value],
          done: false,
        };
      },
    };
  }
}

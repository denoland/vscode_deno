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
  constructor(public map: ImportFileMapContent, public filepath?: string) {}
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
        } catch {
          importMap.imports = {};
        }
      }
    }

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

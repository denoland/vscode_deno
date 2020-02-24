import * as path from "path";
import { promises as fs, readFileSync } from "fs";
import assert from "assert";

import { pathExists, pathExistsSync, str2regexpStr } from "./util";

export interface IImportMaps {
  [Symbol.iterator](): Iterator<string[]>;
  toJSON(): ImportContent;
  resolveModule(moduleName: string): string;
}

type ImportFileMapContent = {
  imports: ImportContent;
};

export type ImportContent = { [prefix: string]: string };

export class ImportMap implements IImportMaps {
  private map: ImportFileMapContent = { imports: {} };
  constructor(map: ImportFileMapContent) {
    this.map = map;
  }
  static async create(importMapFilepath?: string): Promise<IImportMaps> {
    importMapFilepath &&
      assert(
        path.isAbsolute(importMapFilepath),
        `Import-Map filepath require absolute but got ${importMapFilepath}`
      );
    let importMaps: ImportFileMapContent = {
      imports: {}
    };

    //  try resolve import maps
    if (importMapFilepath) {
      if ((await pathExists(importMapFilepath)) === true) {
        const importMapContent = await fs.readFile(importMapFilepath, {
          encoding: "utf8"
        });

        try {
          importMaps = JSON.parse(importMapContent || "");
        } catch {
          importMaps.imports = {};
        }
      }
    }

    return new ImportMap(importMaps);
  }
  static createSync(importMapFilepath?: string): IImportMaps {
    importMapFilepath &&
      assert(
        path.isAbsolute(importMapFilepath),
        `Import-Map filepath require absolute but got ${importMapFilepath}`
      );
    let importMaps: ImportFileMapContent = {
      imports: {}
    };

    //  try resolve import maps
    if (importMapFilepath) {
      if (pathExistsSync(importMapFilepath) === true) {
        const importMapContent = readFileSync(importMapFilepath, {
          encoding: "utf8"
        });

        try {
          importMaps = JSON.parse(importMapContent || "");
        } catch {
          importMaps.imports = {};
        }
      }
    }

    return new ImportMap(importMaps);
  }
  toJSON() {
    return this.map.imports;
  }
  resolveModule(moduleName: string): string {
    for (const [prefix, mapModule] of this) {
      const reg = new RegExp("^" + str2regexpStr(prefix));
      if (reg.test(moduleName)) {
        moduleName = moduleName.replace(reg, mapModule);
        return moduleName;
      }
    }

    return moduleName;
  }
  [Symbol.iterator](): Iterator<string[]> {
    const keys = Object.keys(this.map.imports);

    let currentIndex = 0;

    return {
      next: () => {
        if (currentIndex === keys.length) {
          return {
            value: [],
            done: true
          };
        }

        const key = keys[currentIndex];
        const value = this.map.imports[key];

        currentIndex++;

        return {
          value: [key, value],
          done: false
        };
      }
    };
  }
}

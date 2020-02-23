import * as path from "path";
import { promises as fs, readFileSync } from "fs";
import assert from "assert";

import { pathExists, pathExistsSync } from "./util";

export interface IImportMaps {
  imports: { [key: string]: string };
}

export class ImportMap {
  static async create(importMapFilepath?: string): Promise<IImportMaps> {
    importMapFilepath &&
      assert(
        path.isAbsolute(importMapFilepath),
        `Import-Map filepath require absolute but got ${importMapFilepath}`
      );
    let importMaps: IImportMaps = {
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

    return importMaps;
  }
  static createSync(importMapFilepath?: string): IImportMaps {
    importMapFilepath &&
      assert(
        path.isAbsolute(importMapFilepath),
        `Import-Map filepath require absolute but got ${importMapFilepath}`
      );
    let importMaps: IImportMaps = {
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

    return importMaps;
  }
}

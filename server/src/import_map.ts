import * as path from "path";
import { promises as fs } from "fs";

import { pathExists } from "./util";

export interface IImportMaps {
  imports: { [key: string]: string };
}

export class ImportMap {
  static async create(
    cwd: string,
    importMapFilepath?: string
  ): Promise<IImportMaps> {
    let importMaps: IImportMaps = {
      imports: {}
    };

    //  try resolve import maps
    if (importMapFilepath) {
      const importMapsFilepath = path.isAbsolute(importMapFilepath)
        ? importMapFilepath
        : path.resolve(cwd, importMapFilepath);

      if (await pathExists(importMapsFilepath)) {
        const importMapContent = await fs.readFile(importMapsFilepath, {
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

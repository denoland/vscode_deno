// https://x.nest.land/api/package/std/0.68.0
// https://x.nest.land/api/packages
export const REGISTRY_ID = "x.nest.land";
export type REGISTRY_TYPE = "x.nest.land";

import got from "got";
import {
  ModInfo,
  ModInfoList,
  ModVersionMap,
  Registry,
  ModContents,
} from "./registry";

import { pureFilePathToEntry, getKeyOfVersionMap } from "./_utils";

export class NestLand implements Registry {
  REGISTRY_ID: string = REGISTRY_ID;

  async modList(): Promise<ModInfoList> {
    // https://x.nest.land/api/packages
    const res: {
      name: string;
      description: string;
      packageUploadNames: string[];
    }[] = await got("https://x.nest.land/api/packages").json();
    return res.map(
      (it) =>
        ({
          name: it.name,
          description: it.description,
          versions: it.packageUploadNames.map((it) => it.split("@")[1]),
        } as ModInfo)
    );
  }
  async modVersionList(mod: string): Promise<ModInfo> {
    const res: {
      name: string;
      description: string;
      packageUploadNames: string[];
    } = await got(`https://x.nest.land/api/package/${mod}`).json();
    return {
      name: res.name,
      description: res.description,
      versions: res.packageUploadNames.map((it) => it.split("@")[1]),
    } as ModInfo;
  }
  async modContents(mod: string, version: string[]): Promise<ModVersionMap> {
    // https://x.nest.land/api/package/${mod}/${ver}
    type API_RESPONCE = {
      package: {
        createdAt: string;
      };
      files: Record<string, unknown>;
    };
    if (version.length === 0) {
      const versions = (await this.modVersionList(mod)).versions;
      if (versions === undefined) {
        return {};
      }
      const latest_version = versions[0];
      const res: {
        package: {
          createdAt: string;
        };
        files: Record<string, unknown>;
      } = await got(
        `https://x.nest.land/api/package/${mod}/${latest_version}`
      ).json();
      const result: ModVersionMap = {};
      result[getKeyOfVersionMap(mod, latest_version)] = {
        update_time: res.package.createdAt,
        contents: pureFilePathToEntry(Object.keys(res.files)),
      };
      return result;
    } else {
      return version
        .map((it) => ({
          url: `https://x.nest.land/api/package/${mod}/${it}`,
          version: it,
        }))
        .map(async (it) => ({
          version: it.version,
          res: (await got(it.url).json()) as API_RESPONCE,
        }))
        .reduce(async (p, c) => {
          const result: { [key: string]: ModContents } = { ...p };
          const res = await c;
          result[getKeyOfVersionMap(mod, res.version)] = {
            update_time: res.res.package.createdAt,
            contents: pureFilePathToEntry(Object.keys(res.res.files)),
          };
          return result;
        }, {});
    }
  }
}

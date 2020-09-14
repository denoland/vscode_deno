export const REGISTRY_ID = "deno.land";
export type REGISTRY_TYPE = "deno.land";

import {
  ModInfoList,
  Optional,
  Registry,
  ModVersionMap,
  ModInfo,
  Entry,
  ModContents,
} from "./registry";
import got from "got";

import { getKeyOfVersionMap } from "./_utils";

export class DenoLand implements Registry {
  REGISTRY_ID: string = REGISTRY_ID;

  async std(): Promise<Optional<ModInfo>> {
    // https://cdn.deno.land/std/meta/versions.json
    return this.modVersionList("std");
  }
  async stdContents(version: string[]): Promise<Optional<ModVersionMap>> {
    // https://cdn.deno.land/std/versions/$VERSION/meta/meta.json
    return this.modContents("std", version);
  }
  async modList(): Promise<ModInfoList> {
    type ModuleInfo = {
      name: string;
      description: string;
      star_count: string;
      search_score: number;
    };

    async function* fetchModList(): AsyncGenerator<{
      current: number;
      total: number;
      data: ModuleInfo[];
    }> {
      // https://api.deno.land/modules?limit=100&query=$QUERY
      let response: {
        success: boolean;
        data: {
          total_count: number;
          results: ModuleInfo[];
        };
      };
      let page = 1;
      do {
        response = await got(
          `https://api.deno.land/modules?limit=100&page=${page}`
        ).json();
        if (Array.isArray(response.data.results)) {
          yield {
            current: page,
            total: Math.ceil(response.data.total_count / 100),
            data: response.data.results,
          };
        }
        page++;
      } while (response.success && response.data.results.length > 0);
    }
    const result: ModuleInfo[] = [];
    for await (const modules of fetchModList()) {
      result.push(...modules.data);
    }
    return result.map((it) => ({ name: it.name, description: it.description }));
  }

  async modVersionList(mod: string): Promise<ModInfo> {
    const res: { versions: string[] } = await got(
      `https://cdn.deno.land/${mod}/meta/versions.json`
    ).json();
    return { name: mod, versions: res.versions } as ModInfo;
  }

  async modContents(mod: string, version: string[]): Promise<ModVersionMap> {
    // https://cdn.deno.land/${mod}/versions/${ver}/meta/meta.json
    type API_RESPONCE = {
      uploaded_at: string;
      directory_listing: [{ path: string; type: "dir" | "file" }];
    };

    const mapper = (it: { type: "dir" | "file"; path: string }): Entry => ({
      type: it.type === "dir" ? "folder" : it.type,
      value: it.path,
    });

    if (version.length === 0) {
      const versions = (await this.modVersionList(mod)).versions;
      if (versions === undefined) {
        return {};
      }
      const latest_version = versions[0];
      const res: API_RESPONCE = await got(
        `https://cdn.deno.land/${mod}/versions/${latest_version}/meta/meta.json`
      ).json();
      const result: ModVersionMap = {};
      result[getKeyOfVersionMap(mod, latest_version)] = {
        update_time: res.uploaded_at,
        contents: res.directory_listing.map(mapper),
      };
      return result;
    } else {
      return version
        .map((it) => ({
          url: `https://cdn.deno.land/${mod}/versions/${it}/meta/meta.json`,
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
            update_time: res.res.uploaded_at,
            contents: res.res.directory_listing.map(mapper),
          };
          return result;
        }, {});
    }
  }
}

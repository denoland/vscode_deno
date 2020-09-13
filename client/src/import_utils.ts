/* eslint @typescript-eslint/triple-slash-reference: "off" */
// CGQAQ: Without next line the test will fail, using import won't work
/// <reference path="./types/vscode-cache.d.ts" />

import got from "got";
import VC from "vscode-cache";

export interface ModuleInfo {
  name: string;
  description: string;
  star_count: string;
  search_score: number;
}

export async function* fetchModList(): AsyncGenerator<{
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

// this function now is search from cache only
export async function searchX(
  cache: VC,
  keyword: string
): Promise<ModuleInfo[]> {
  if (cache.has("mod_list")) {
    const buff = cache.get("mod_list") as ModuleInfo[];
    return buff
      .filter((it) => it.name.startsWith(keyword))
      .sort((a, b) => b.search_score - a.search_score);
  } else {
    return [];
  }
}

interface ModVersions {
  latest: string;
  versions: string[];
}
export async function listVersionsOfMod(
  module_name: string
): Promise<ModVersions> {
  // https://cdn.deno.land/$MODULE/meta/versions.json
  const response: ModVersions = await got(
    `https://cdn.deno.land/${encodeURIComponent(
      module_name
    )}/meta/versions.json`
  ).json();
  return response;
}

interface ModTreeItem {
  path: string;
  size: number;
  type: string;
}

interface ModTree {
  uploaded_at: string; // Use this to update cache
  directory_listing: ModTreeItem[];
}
export async function modTreeOf(
  vc: VC | undefined,
  module_name: string,
  version = "latest"
): Promise<ModTree> {
  // https://cdn.deno.land/$MODULE/versions/$VERSION/meta/meta.json
  let ver = version;
  if (ver === "latest") {
    const vers = await listVersionsOfMod(module_name);
    ver = vers.latest;
  }

  const cache_key = `mod_tree:${module_name}@${ver}`;
  if (vc?.has(cache_key)) {
    // use cache
    return vc.get(cache_key) as ModTree;
  }

  const response: ModTree = await got(
    `https://cdn.deno.land/${encodeURIComponent(
      module_name
    )}/versions/${ver}/meta/meta.json`
  ).json();

  // cache it
  vc?.put(cache_key, response);

  return response;
}

interface ImportUrlInfo {
  domain: string;
  module: string;
  version: string;
  path: string;
}

export function parseImportStatement(text: string): ImportUrlInfo | undefined {
  const reg_groups = text.match(/.*?['"](?<url>.*?)['"]/)?.groups;
  if (!reg_groups) {
    return undefined;
  }
  const import_url = reg_groups["url"] ?? "";
  try {
    const url = new URL(import_url);
    const components = url.pathname.split("/");
    const parse = (components: string[]) => {
      const module_info = components[0].split("@");
      if (module_info.length > 1) {
        const module = module_info[0];
        const version = module_info[1].length === 0 ? "latest" : module_info[1];
        const path = "/" + components.slice(1, components.length).join("/");
        return {
          domain: url.hostname,
          module,
          version,
          path,
        };
      } else {
        const module = module_info[0];
        const version = "latest";
        const path = "/" + components.slice(1, components.length).join("/");
        return {
          domain: url.hostname,
          module,
          version,
          path,
        };
      }
    };
    if (components.length > 2) {
      const m = components[1];
      if (m === "x") {
        return parse(components.slice(2, components.length));
      } else {
        return parse(components.slice(1, components.length));
      }
    }
  } catch {
    return undefined;
  }
}

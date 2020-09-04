/* eslint @typescript-eslint/triple-slash-reference: "off" */
// CGQAQ: Without next line the test will fail, using import won't work
/// <reference path="./types/vscode-cache.d.ts" />

import got from "got";
import VC from "vscode-cache";

interface ModuleInfo {
  name: string;
  description: string;
  star_count: string;
  search_score: number;
}

export async function searchX(keyword: string): Promise<ModuleInfo[]> {
  // https://api.deno.land/modules?limit=10&query=$QUERY
  const response: {
    success: boolean;
    data: {
      total_count: number;
      results: ModuleInfo[];
    };
  } = await got(
    `https://api.deno.land/modules?limit=20&query=${keyword}`
  ).json();
  if (response.success) {
    const arr = response.data.results.sort(
      (a, b) => b.search_score - a.search_score
    );
    if (arr.length < 20) {
      return arr;
    }
    return arr.splice(0, 20);
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
    `https://cdn.deno.land/${module_name}/meta/versions.json`
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
    `https://cdn.deno.land/${module_name}/versions/${ver}/meta/meta.json`
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
  const importUrl = text.match(
    /.*?['"](\w+:\/\/)(?<domain>.*?)\/(?<lib>\w+\/?)(?<xlib>\w+)?(@(?<ver>.*?))?(?<path>\/.*?)['"]/
  )?.groups;
  if (!importUrl) {
    return undefined;
  }
  const [domain, module, version, path] = [
    importUrl["domain"],
    importUrl["xlib"] ?? importUrl["lib"],
    importUrl["ver"] === "" || importUrl["ver"] === undefined
      ? "latest"
      : importUrl["ver"],
    importUrl["path"] ?? "/",
  ];
  return {
    domain,
    module,
    version,
    path,
  } as ImportUrlInfo;
}

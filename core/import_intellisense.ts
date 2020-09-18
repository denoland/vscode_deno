import got from "got";

export const IMPORT_REG = /^.*?[import|export].+?from.+?['"](?<url>[0-9a-zA-Z-_@~:/.?#:&=%+]*)/;

export function parseURLFromImportStatement(line: string): URL | undefined {
  const matchedGroups = line.match(IMPORT_REG)?.groups;
  if (!matchedGroups) {
    return undefined;
  }
  const url = matchedGroups["url"];
  if (!url) return undefined;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return new URL(url);
  }
  return undefined;
}

export interface WellKnown {
  version: 1;
}

async function fetchWellKnown(origin: string): Promise<WellKnown> {
  const wellknown = await got(
    `${origin}/.well-known/deno-import-intellisense.json`,
    {}
  ).json();
  if (typeof wellknown !== "object" || !wellknown) {
    throw new Error(
      `Invalid WellKnown: file ${origin}/.well-known/deno-import-intellisense.json is not structued correctly`
    );
  }
  const wk = wellknown as WellKnown;
  if (wk.version !== 1) {
    throw new Error(
      `Invalid WellKnown: file ${origin}/.well-known/deno-import-intellisense.json has non '1' version`
    );
  }
  return { version: 1 };
}

export async function getWellKnown(origin: string): Promise<WellKnown> {
  return fetchWellKnown(origin);
}

export const IMPORT_REG =
  /^.*?[import|export].+?from.+?['"](?<url>[0-9a-zA-Z-_@~:/.?#:&=%+]*)/;

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

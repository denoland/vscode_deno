import { Entry } from "./registry";
import path from "path";

export function pureFilePathToEntry(pathes: string[]): Entry[] {
  const folders: string[] = [];
  for (const p of pathes) {
    const folder = path.dirname(p);
    if (!folders.includes(folder)) {
      folders.push(folder);
    }
  }
  return [
    ...folders.map((it) => ({ type: "folder", value: it } as Entry)),
    ...pathes.map((it) => ({ type: "file", value: it } as Entry)),
  ];
}

export function getKeyOfVersionMap(mod: string, version: string): string {
  return `${mod}@${version}`;
}

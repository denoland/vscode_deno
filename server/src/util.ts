import { promises as fs } from "fs";

// cover filepath string to regexp string
// Because the `\` string is included in the path to Windows
// So we need to translate it once
// `/^C:\Users\runneradmin\AppData\Local\deno\deps\/` -> `/^C:\\Users\\runneradmin\\AppData\\Local\\deno\\deps\\/`
export function str2regexpStr(filepath: string): string {
  return filepath.replace(/\\/gm, "\\\\");
}

export async function pathExists(filepath: string): Promise<boolean> {
  try {
    await fs.stat(filepath);
    return true;
  } catch (err) {
    return false;
  }
}

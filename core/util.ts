import { promises as fs, statSync } from "fs";

export function pathExistsSync(filepath: string): boolean {
  try {
    statSync(filepath);
    return true;
  } catch (err) {
    return false;
  }
}

export async function pathExists(filepath: string): Promise<boolean> {
  try {
    await fs.stat(filepath);
    return true;
  } catch (err) {
    return false;
  }
}

// cover filepath string to regexp string
// Because the `\` string is included in the path to Windows
// So we need to translate it once
// `/^C:\Users\runneradmin\AppData\Local\deno\deps\/` -> `/^C:\\Users\\runneradmin\\AppData\\Local\\deno\\deps\\/`
export function str2regexpStr(filepath: string): string {
  return filepath.replace(/\\/gm, "\\\\");
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

export function isHttpURL(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

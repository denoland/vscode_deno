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

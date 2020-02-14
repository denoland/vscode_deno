import { promises as fs, statSync } from "fs";

export function pathExistsSync(filepath: string) {
  try {
    return statSync(filepath);
  } catch (err) {
    return false;
  }
}

export function pathExists(filepath: string) {
  try {
    return fs.stat(filepath);
  } catch (err) {
    return false;
  }
}

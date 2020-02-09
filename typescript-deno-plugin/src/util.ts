import * as fs from "fs";

export function pathExistsSync(filepath: string) {
  try {
    return fs.existsSync(filepath);
  } catch (err) {
    return false;
  }
}

import * as path from "path";

export type Extension =
  | ".ts"
  | ".tsx"
  | ".d.ts"
  | ".js"
  | ".jsx"
  | ".json"
  | ".wasm"
  | "";

export function getExtensionFromFile(filename: string): Extension {
  const extName = path.extname(filename);

  if (extName === ".ts") {
    if (/\.d\.ts$/.test(filename)) {
      return ".d.ts";
    }
  }

  return extName as Extension;
}

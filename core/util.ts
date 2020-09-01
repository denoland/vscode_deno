import { promises as fs, statSync } from "fs";
import crypto from "crypto";
import path from "path";

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

export function normalizeFilepath(filepath: string): string {
  return path.normalize(
    filepath
      // in Windows, filepath maybe `c:\foo\bar` tut the legal path should be `C:\foo\bar`
      .replace(/^([a-z]):\\/, (_, $1) => $1.toUpperCase() + ":\\")
      // There are some paths which are unix style, this style does not work on win32 systems
      .replace(/\//gm, path.sep)
  );
}

// convert any path to absolute path
export function toAbsolutePath(anyPath: string, rootPath: string): string {
  return path.isAbsolute(anyPath) ? anyPath : path.resolve(rootPath, anyPath);
}

// ref: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
// cover filepath string to regexp string
// Because the `\` string is included in the path to Windows
// So we need to translate it once
// `/^C:\Users\runneradmin\AppData\Local\deno\deps\/` -> `/^C:\\Users\\runneradmin\\AppData\\Local\\deno\\deps\\/`
export function escapeRegExp(str: string): string {
  return str.replace(/[.*+\-?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

export function isHttpURL(str: string): boolean {
  if (!/^https?:\/\/.+/.test(str)) {
    return false;
  }
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

// hash a URL with it's pathname and search
export function hashURL(url: URL): string {
  return crypto
    .createHash("sha256")
    .update(url.pathname + url.search)
    .digest("hex");
}

export function isValidDenoDocument(languageID: string): boolean {
  return [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact",
  ].includes(languageID);
}

export function isUntitledDocument(filename: string): boolean {
  // In vscode, tsserver may crash because a temporary document is not saved
  return /^untitled:/.test(filename);
}

/**
 * find module which has no extension name
 * We hope it can find the module correctly in Deno's way
 * eg. `import { foo } from "./bar"` should be `import { foo } from "./bar.ts"`
 * @param filepath
 * @param moduleName
 */
export function findNonExtensionModule(
  filepath: string,
  moduleName: string
): string {
  function resolveModule(modulePath: string): string | void {
    if (pathExistsSync(path.resolve(path.dirname(filepath), modulePath))) {
      return modulePath;
    }

    return;
  }

  const denoSupportedExtensions = [
    ".ts",
    ".tsx",
    ".d.ts",
    ".js",
    ".jsx",
    ".mjs",
  ];

  while (denoSupportedExtensions.length) {
    const extension = denoSupportedExtensions.shift();

    const modulePath = resolveModule(moduleName + extension);

    if (modulePath) {
      return modulePath;
    }
  }

  return moduleName;
}

/**
 * Returns true when value is set (not null nor undefined) and is not empty
 * @param [value] {string | null}
 */
export function isSetAndNotEmptyString(value?: string | null): boolean {
  return value ? value !== "" : false;
}

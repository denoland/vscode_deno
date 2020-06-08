import * as fs from "fs";
import * as path from "path";
import crypto from "crypto";
import { URL, fileURLToPath } from "url";
import {
  resolve,
  ImportMaps,
  parseFromString,
} from "import-maps";
import { Logger } from "logger";
import { HashMeta } from "./module_resolver/hash_meta";
import { universalModuleResolver } from "./module_resolver/universal_module_resolver";

export function getDenoDir(): string {
  // ref https://deno.land/manual.html
  // On Linux/Redox: $XDG_CACHE_HOME/deno or $HOME/.cache/deno
  // On Windows: %LOCALAPPDATA%/deno (%LOCALAPPDATA% = FOLDERID_LocalAppData)
  // On macOS: $HOME/Library/Caches/deno
  // If something fails, it falls back to $HOME/.deno
  let denoDir = process.env.DENO_DIR;
  if (denoDir === undefined) {
    switch (process.platform) {
      case "win32":
        denoDir = `${process.env.LOCALAPPDATA}\\deno`;
        break;
      case "darwin":
        denoDir = `${process.env.HOME}/Library/Caches/deno`;
        break;
      case "linux":
        denoDir = process.env.XDG_CACHE_HOME
          ? `${process.env.XDG_CACHE_HOME}/deno`
          : `${process.env.HOME}/.cache/deno`;
        break;
      default:
        denoDir = `${process.env.HOME}/.deno`;
    }
  }

  return denoDir;
}

export function getDenoDepsDir(): string {
  return path.join(getDenoDir(), "deps");
}

export function isInDenoDir(filepath: string): boolean {
  filepath = normalizeFilepath(filepath);
  const denoDir = getDenoDir();
  return filepath.startsWith(denoDir);
}

export function getPluginPath(): string {
  return path.resolve(__dirname, "..");
}

export function getDenoDtsPath(
  specifier: string,
): string | undefined {
  let file: string = path.resolve(getDenoDir(), specifier);

  if (fs.existsSync(file)) {
    return file;
  }

  file = path.resolve(getPluginPath(), "lib", specifier);
  if (fs.existsSync(file)) {
    return file;
  }

  return undefined;
}

export function getModuleWithQueryString(
  moduleName: string,
): string | undefined {
  let name = moduleName;
  for (
    const index = name.indexOf("?");
    index !== -1;
    name = name.substring(index + 1)
  ) {
    const sub = name.substring(0, index);
    if (sub.endsWith(".ts") || sub.endsWith(".tsx")) {
      const cutLength = moduleName.length - name.length;
      return moduleName.substring(0, index + cutLength) || undefined;
    }
  }
  return undefined;
}

export function normalizeFilepath(filepath: string): string {
  return path.normalize(
    filepath
      // in Windows, filepath maybe `c:\foo\bar` tut the legal path should be `C:\foo\bar`
      .replace(/^([a-z]):\\/, (_, $1) => $1.toUpperCase() + ":\\")
      // There are some paths which are unix style, this style does not work on win32 systems
      .replace(/\//gm, path.sep),
  );
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
  if (!str.startsWith("http://") && !str.startsWith("https://")) {
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

export function pathExistsSync(filepath: string): boolean {
  try {
    fs.statSync(filepath);
    return true;
  } catch (err) {
    return false;
  }
}

export function parseImportMapFromFile(cwd: string, file?: string): ImportMaps {
  const importmps: ImportMaps = {
    imports: {},
    scopes: {},
  };

  if (file == null) {
    return importmps;
  }

  if (!path.isAbsolute(file)) {
    file = path.resolve(cwd, file);
  }

  const fullFilePath = normalizeFilepath(file);

  if (!pathExistsSync(fullFilePath)) {
    return importmps;
  }

  const content = fs.readFileSync(fullFilePath, {
    encoding: "utf8",
  });

  try {
    return parseFromString(content, `file://${cwd}/`);
  } catch {
    return importmps;
  }
}

export function parseModuleName(
  moduleName: string,
  containingFile: string,
  parsedImportMap?: ImportMaps | null,
  logger?: Logger,
): string | undefined {
  if (parsedImportMap != null) {
    try {
      let scriptURL: URL;
      if (isInDenoDir(containingFile)) {
        const meta = HashMeta.create(`${containingFile}.metadata.json`);
        if (meta && meta.url) {
          scriptURL = meta.url;
        } else {
          scriptURL = new URL("file:///" + path.dirname(containingFile) + "/");
        }
      } else {
        scriptURL = new URL("file:///" + path.dirname(containingFile) + "/");
      }

      logger && logger.info(`baseUrl: ${scriptURL}`);

      const moduleUrl = resolve(
        moduleName,
        parsedImportMap,
        scriptURL,
      );

      if (moduleUrl.protocol === "file:") {
        return fileURLToPath(moduleUrl.href);
      }

      if (moduleUrl.protocol === "http:" || moduleUrl.protocol === "https:") {
        return moduleUrl.href;
      }

      // just support protocol: file, http, https
      return undefined;
    } catch (e) {
      if (logger) logger.info("moduleName: " + moduleName);
      if (logger) logger.info("e: " + (e as Error).stack);
      return undefined;
    }
  }
}

export function resolveDenoModule(moduleName: string) {
  return universalModuleResolver.resolve(
    moduleName,
  );
}
import {
  GetCompletionsAtPositionOptions,
  LanguageService,
  ScriptElementKind,
  CompletionEntry,
} from "typescript/lib/tsserverlibrary";
import { TsUtils } from "../ts-utils";
import {
  getDenoDir,
  parseImportMapFromFile,
} from "../utils";
import { readdirSync, statSync } from "fs";
import { ImportMaps } from "import-maps";
import { join } from "path";

const importPathSanitizeRegex = /^\ ?['"](.*)['"]$/;

interface ImportPath {
  path: string;
  isDir: boolean;
}

export default function getCompletionsAtPositionWrapper(
  projectDirectory: string,
  config: any,
  tsLs: LanguageService,
  tsUtils: TsUtils,
) {
  function getCompletionsAtPosition(
    fileName: string,
    position: number,
    options: GetCompletionsAtPositionOptions,
  ) {
    const node = tsUtils.getNode(fileName, position);
    if (!node) {
      return tsLs.getCompletionsAtPosition(fileName, position, options);
    }

    // 254 === ImportDeclaration
    // 10 === StringLiteral
    if (node.parent.kind !== 254 || node.kind !== 10) {
      return tsLs.getCompletionsAtPosition(fileName, position, options);
    }

    const importMap =
      parseImportMapFromFile(projectDirectory, config.importmap)["imports"];
    const importPath = tsUtils.getNodeText(node, fileName);

    const sanitizedImportPath =
      (importPathSanitizeRegex.exec(importPath) as string[])[1];

    const importMapCompletions = getImportMapCompletions(
      sanitizedImportPath,
      importMap,
    );

    const importMappedPath = applyImportMap(sanitizedImportPath, importMap);
    const completions = getPathCompletions(importMappedPath, fileName);

    return {
      isGlobalCompletion: false,
      isMemberCompletion: true,
      isNewIdentifierLocation: false,
      entries: [...completions, ...importMapCompletions],
    };
  }

  return getCompletionsAtPosition;
}

const httpRegex = /^https?:\/\//;
const relativeRegex = /\.\.?\//;

function getPathCompletions(path: string, fileName: string) {
  const lastPath = path.substr(path.lastIndexOf("/") + 1);
  const basePath = path.substring(0, path.length - lastPath.length);

  const denoDir = getDenoDir();

  const importPaths: ImportPath[] = [];

  if (httpRegex.test(basePath)) {
    importPaths.push(...getHttpImportPaths(basePath, denoDir));
  }

  if (relativeRegex.test(basePath)) {
    importPaths.push(...getRelativeImportPaths(fileName, basePath));
  }

  const completions: CompletionEntry[] = [];

  for (const importPath of importPaths) {
    const {
      path,
      isDir,
    } = importPath;

    if (path.startsWith(lastPath)) {
      completions.push({
        name: path.slice(lastPath.length),
        kind: isDir
          ? ScriptElementKind.directory
          : ScriptElementKind.scriptElement,
        sortText: "",
        kindModifiers: isDir ? "" : ".ts",
      });
    }
  }

  return completions;
}

function getRelativeImportPaths(fileName: string, relativePath: string) {
  const basePath = fileName.substr(0, fileName.lastIndexOf("/"));
  const path = join(basePath, relativePath);
  const importPaths = getImportPathsFromDir(path)
    .filter((importPath) => {
      if (importPath.isDir) {
        return true;
      }

      return importPath.path.endsWith(".ts");
    });

  return importPaths;
}

function applyImportMap(path: string, importMap: ImportMaps["imports"]) {
  for (const importMapEntry of Object.keys(importMap)) {
    if (!path.startsWith(importMapEntry)) {
      continue;
    }
    let importMapPath = importMap[importMapEntry];
    if (importMapPath === null) {
      continue;
    }
    if (typeof importMapPath === "object") {
      importMapPath = importMapPath.toString();
    }

    return importMapPath + path.slice(importMapEntry.length);
  }

  return path;
}

function getHttpImportPaths(basePath: string, denoDir: string) {
  const url = basePath.replace(httpRegex, "");
  const baseDir = `${denoDir}/gen/https/${url}`;
  const importPaths: ImportPath[] = getImportPathsFromDir(baseDir)
    .filter((importPath) => {
      if (importPath.isDir) {
        return true;
      }
      if (
        importPath.path.endsWith(".js") || importPath.path.endsWith(".js.map")
      ) {
        return false;
      }

      return true;
    })
    .map((importPath) => {
      if (!importPath.isDir) {
        // importPath.path === xxx.ts.meta
        importPath.path = importPath.path.slice(0, importPath.path.length - 5);
      }

      return importPath;
    });

  return importPaths;
}

function getImportPathsFromDir(dir: string): ImportPath[] {
  try {
    const importPaths: ImportPath[] = [];
    const importPathFiles = readdirSync(dir);
    for (const importPathFile of importPathFiles) {
      const fileStats = statSync(`${dir}/${importPathFile}`);
      importPaths.push({
        path: importPathFile,
        isDir: fileStats.isDirectory(),
      });
    }

    return importPaths;
  } catch {
    return [];
  }
}

function getImportMapCompletions(
  importPath: string,
  importMap: ImportMaps["imports"],
) {
  const importMapEntries = Object.keys(importMap);
  const completions: CompletionEntry[] = [];

  for (const importMapEntry of importMapEntries) {
    if (importMapEntry.startsWith(importPath)) {
      completions.push({
        name: importMapEntry.slice(importPath.length),
        kind: ScriptElementKind.directory,
        sortText: "",
      });
    }
  }

  return completions;
}

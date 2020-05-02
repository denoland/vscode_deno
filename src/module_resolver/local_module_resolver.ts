import path from "path";

import { normalizeFilepath, pathExistsSync } from "../utils";

import { IModuleResolver, DenoExtension, DenoResolvedModule } from "./types";

export const localModuleResolver: IModuleResolver = {
  resolve(
    moduleName: string,
    containingFile: string,
    originModuleName: string = moduleName,
  ): (void | DenoResolvedModule) {
    if (moduleName.startsWith("file://")) {
      // file protocol is always a unix style path
      // eg: file:///Users/deno/project/mod.ts in MacOS
      // eg: file:///Home/deno/project/mod.ts in Linux
      // eg: file://d:/project/mod.ts in Window
      moduleName = moduleName.replace(/^file:\/\//, "");
    }

    const moduleFilepath = path.resolve(
      path.dirname(containingFile),
      normalizeFilepath(moduleName),
    );

    if (!pathExistsSync(moduleFilepath)) {
      return;
    }

    return {
      originModuleName,
      filepath: moduleFilepath,
      extension: getExtensionFromFile(moduleFilepath),
    };
  },
};

export function getExtensionFromFile(filename: string): DenoExtension {
  const extName = path.extname(filename);

  if (extName === ".ts") {
    if (/\.d\.ts$/.test(filename)) {
      return ".d.ts";
    }
  }

  return extName as DenoExtension;
}

import path from "path";

import { pathExistsSync } from "../utils";

import { IModuleResolver, DenoExtension, DenoResolvedModule } from "./types";

export const localModuleResolver: IModuleResolver = {
  resolve(
    moduleName: string,
    originModuleName: string = moduleName,
  ): (undefined | DenoResolvedModule) {
    if (!pathExistsSync(moduleName)) {
      return;
    }

    return {
      originModuleName,
      filepath: moduleName,
      extension: getExtensionFromFile(moduleName),
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

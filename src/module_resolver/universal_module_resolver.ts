import { isHttpURL } from "../utils";

import { IModuleResolver, DenoResolvedModule } from "./types";
import { remoteModuleResolver } from "./remote_module_resolver";
import { localModuleResolver } from "./local_module_resolver";

export const universalModuleResolver: IModuleResolver = {
  resolve(
    moduleName: string,
    containingFile: string,
    originModuleName: string = moduleName,
  ): (void | DenoResolvedModule) {
    // If import from remote
    if (isHttpURL(moduleName)) {
      return remoteModuleResolver.resolve(
        moduleName,
        containingFile,
        originModuleName,
      );
    }

    return localModuleResolver.resolve(
      moduleName,
      containingFile,
      originModuleName,
    );
  },
};

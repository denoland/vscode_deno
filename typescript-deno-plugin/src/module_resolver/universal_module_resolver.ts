import { isHttpURL } from "../utils";

import { IModuleResolver, DenoResolvedModule } from "./types";
import { remoteModuleResolver } from "./remote_module_resolver";
import { localModuleResolver } from "./local_module_resolver";

export const universalModuleResolver: IModuleResolver = {
  resolve(
    moduleName: string,
    originModuleName: string = moduleName,
  ): (undefined | DenoResolvedModule) {
    // If import from remote
    if (isHttpURL(moduleName)) {
      return remoteModuleResolver.resolve(
        moduleName,
        originModuleName,
      );
    }

    return localModuleResolver.resolve(
      moduleName,
      originModuleName,
    );
  },
};

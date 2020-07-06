import { URL } from "url";
import path from "path";

import { getDenoDepsDir, hashURL, isHttpURL } from "../utils";

import { IModuleResolver, DenoResolvedModule } from "./types";
import { HashMeta } from "./hash_meta";
import { universalModuleResolver } from "./universal_module_resolver";

export const remoteModuleResolver: IModuleResolver = {
  resolve(
    moduleName: string,
    originModuleName: string = moduleName,
  ): (undefined | DenoResolvedModule) {
    const url = new URL(moduleName);

    const originDir = path.join(
      getDenoDepsDir(),
      url.protocol.replace(/:$/, ""), // https: -> https
      `${url.hostname}${url.port ? `_PORT${url.port}` : ""}`, // hostname.xyz:3000 -> hostname.xyz_PORT3000
    );

    const hash = hashURL(url);

    const metaFilepath = path.join(originDir, `${hash}.metadata.json`);

    const meta = HashMeta.create(metaFilepath);

    if (!meta) {
      return;
    }

    let redirect = meta.headers.location;

    if (redirect) {
      redirect = isHttpURL(redirect) // eg: https://redirect.com/path/to/redirect
        ? redirect
        : path.posix.isAbsolute(redirect) // eg: /path/to/redirect
        ? `${url.protocol}//${url.host}${redirect}`
        : // eg: ./path/to/redirect
          `${url.protocol}//${url.host}${
            path.posix.resolve(
              url.pathname,
              redirect,
            )
          }`;

      // avoid Circular
      if (!isHttpURL(redirect) || redirect === moduleName) {
        return;
      }

      return universalModuleResolver.resolve(redirect, originModuleName);
    }

    const moduleFilepath = path.join(originDir, hash);

    const typescriptTypes = meta.headers["x-typescript-types"];
    if (typescriptTypes) {
      const typeModule = universalModuleResolver.resolve(
        typescriptTypes,
        originModuleName,
      );

      if (typeModule) {
        return typeModule;
      }
    }

    return {
      originModuleName,
      filepath: moduleFilepath,
      extension: meta.extension,
    };
  },
};

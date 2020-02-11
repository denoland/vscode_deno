import * as path from "path";
import * as fs from "fs";

import { Deno } from "./deno";
import { Logger } from "./logger";
import { pathExistsSync } from "./util";

type ResolvedModule = {
  origin: string; // the origin resolve module
  filepath: string; // full file name path. May be relative or absolute
  module: string; // final resolve module. It may not have an extension
};

type ImportMaps = {
  imports: { [key: string]: string };
};

type DenoModuleHeaders = {
  mime_type: string;
  redirect_to: string;
};

// the resolver defined how to resolve Deno module
export class ModuleResolver {
  private importMaps: ImportMaps = { imports: {} };
  private isInDenoDeps: boolean = this.file.indexOf(Deno.DENO_DIR) === 0; // Whether the current module is in the Deno dependency directory
  constructor(
    private readonly file: string,
    private readonly logger: Logger,
    private readonly workspaceDir: string,
    importMapsFile?: string
  ) {
    if (importMapsFile) {
      this.importMaps = this.resolveImportMaps(importMapsFile);
    }
  }
  // resolve modules
  resolveModuleNames(moduleNames: string[]): ResolvedModule[] {
    return moduleNames.map(moduleName => {
      const resolvedModule: ResolvedModule = {
        origin: moduleName,
        filepath: "",
        module: ""
      };

      // resolve module from Import Maps // eg. `import_map.json`
      // {
      //   "imports": {
      //     "http/": "https://deno.land/std/http/"
      //   }
      // }
      // resolve `http/server.ts` -> `https://deno.land/std/http/server.ts`
      moduleName = this.resolveModuleNameFromImportMaps(moduleName);

      // if module is ESM. Then the module name may contain url query and url hash
      // We need to remove it
      moduleName = trimQueryAndHashFromPath(moduleName);

      // for ESM support // Some modules do not specify the domain name, but the root directory of the domain name
      // eg. `$DENO_DIR/deps/https/dev.jspm.io/react`
      // import { dew } from "/npm:react@16.12.0/index.dew.js";
      // export default dew();
      // import "/npm:react@16.12.0/cjs/react.development.dew.js";
      // import "/npm:object-assign@4?dew";
      // import "/npm:prop-types@15/checkPropTypes?dew";
      moduleName = this.resolveFromDenoDir(moduleName);

      // cover `https://example.com/mod.ts` -> `$DENO_DIR/deps/https/example.com/mod.ts`
      moduleName = resolvedModule.filepath = this.convertRemoteToLocalCache(
        moduleName
      );

      // trim extension name
      // eg. `./example.ts` -> `./example`
      moduleName = resolvedModule.module = trimExtensionName(moduleName);

      return resolvedModule;
    });
  }
  // resolve Import Maps
  private resolveImportMaps(importMapsFile: string): ImportMaps {
    let importMaps: ImportMaps = { imports: {} };

    importMapsFile = path.isAbsolute(importMapsFile)
      ? importMapsFile
      : path.resolve(this.workspaceDir, importMapsFile);

    if (pathExistsSync(importMapsFile)) {
      const importMapContent = fs.readFileSync(importMapsFile, {
        encoding: "utf8"
      });

      try {
        importMaps = JSON.parse(importMapContent || "{}");
      } catch {}
    }

    if (typeof importMaps.imports !== "object") {
      importMaps.imports = {};
    }

    return importMaps;
  }
  private resolveModuleNameFromImportMaps(moduleName: string): string {
    const maps = this.importMaps.imports || {};

    for (const prefix in maps) {
      const mapModule = maps[prefix];

      const reg = new RegExp("^" + prefix);
      if (reg.test(moduleName)) {
        moduleName = moduleName.replace(reg, mapModule);
      }
    }

    return moduleName;
  }
  private convertRemoteToLocalCache(moduleName: string): string {
    if (!/^https?:\/\//.test(moduleName)) {
      return moduleName;
    }

    // "https://deno.land/x/std/log/mod" to "$DENO_DIR/deps/https/deno.land/x/std/log/mod" (no ".ts" because stripped)
    let filepath = path.resolve(Deno.DENO_DEPS, moduleName.replace("://", "/"));

    if (!pathExistsSync(filepath)) {
      const headersPath = `${filepath}.headers.json`;
      if (pathExistsSync(headersPath)) {
        const headers: DenoModuleHeaders = JSON.parse(
          fs.readFileSync(headersPath, { encoding: "utf-8" })
        );
        if (moduleName !== headers.redirect_to) {
          const redirectFilepath = this.convertRemoteToLocalCache(
            headers.redirect_to
          );
          this.logger.info(`redirect "${filepath}" to "${redirectFilepath}".`);
          filepath = redirectFilepath;
        }
      }
    }

    this.logger.info(`convert "${moduleName}" to "${filepath}".`);

    return filepath;
  }
  private resolveFromDenoDir(moduleName: string): string {
    if (this.isInDenoDeps && moduleName.indexOf("/") === 0) {
      const paths = moduleName.split("/");

      const denoDepsFilepath = Deno.DENO_DEPS;

      paths.shift(); // remove `/` prefix of url path

      const urlPaths = this.file.replace(denoDepsFilepath, "").split(path.sep);

      urlPaths.shift(); // remove prefix of filepath `path.sep`

      const protocol = urlPaths[0];
      const domainName = urlPaths[1];

      return path.join(denoDepsFilepath, protocol, domainName, ...paths);
    }
    return moduleName;
  }
}

function trimQueryAndHashFromPath(moduleName: string): string {
  const queryIndex = moduleName.indexOf("?");
  const hashIndex = moduleName.indexOf("#");

  if (queryIndex < 0 && hashIndex < 0) {
    return moduleName;
  } else if (queryIndex >= 0) {
    moduleName = moduleName.substr(0, queryIndex);
    return trimQueryAndHashFromPath(moduleName);
  } else if (hashIndex >= 0) {
    moduleName = moduleName.substr(0, hashIndex);
    return trimQueryAndHashFromPath(moduleName);
  }

  return moduleName;
}

function trimExtensionName(moduleName: string): string {
  if (/(\.d)?\.(t|j)sx?$/.test(moduleName) === false) {
    return moduleName;
  }
  const name = moduleName.replace(/(\.d)?\.(t|j)sx?$/, "");
  return name;
}

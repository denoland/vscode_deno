// modified from https://github.com/Microsoft/typescript-tslint-plugin
import * as fs from "fs";
import * as path from "path";

import merge from "deepmerge";
import ts_module from "typescript/lib/tsserverlibrary";

import { Logger } from "./logger";
import { getDenoDir } from "./shared";

const TYPESCRIPT_EXT_REG = /\.(t|j)sx?$/;

let logger: Logger;

function existsSync(filepath: string) {
  try {
    return fs.existsSync(filepath);
  } catch (err) {
    return false;
  }
}

type IImportMap = {
  imports: { [key: string]: string; };
};

type IConfig = {
  enable: boolean;
  dtsFilepaths?: string[];
  import_map?: string;
  workspaceDir?: string;
};

type IDenoModuleHeaders = {
  mime_type: string;
  redirect_to: string;
};

class DenoPlugin implements ts_module.server.PluginModule {
  // see https://github.com/denoland/deno/blob/2debbdacb935cfe1eb7bb8d1f40a5063b339d90b/js/compiler.ts#L159-L170
  private DEFAULT_OPTIONS: ts_module.CompilerOptions = {};
  private MUST_OVERWRITE_OPTIONS: ts_module.CompilerOptions = {};
  private config: IConfig = {
    dtsFilepaths: [],
    enable: true,
    import_map: "",
    workspaceDir: ""
  };
  private info?: ts_module.server.PluginCreateInfo;

  constructor(private typescript: typeof ts_module) {
    this.DEFAULT_OPTIONS = {
      allowJs: true,
      checkJs: false,
      strict: true,
      esModuleInterop: true,
      jsx: typescript.JsxEmit.React,
      module: typescript.ModuleKind.ESNext,
      moduleResolution: typescript.ModuleResolutionKind.NodeJs,
      outDir: "$deno$",
      resolveJsonModule: true,
      sourceMap: true,
      stripComments: true,
      target: typescript.ScriptTarget.ESNext,
      noEmit: this.DEFAULT_OPTIONS.noEmit,
      noEmitHelpers: this.DEFAULT_OPTIONS.noEmitHelpers
    };

    // No matter how tsconfig.json is set in the working directory
    // It will always overwrite the configuration
    this.MUST_OVERWRITE_OPTIONS = {
      jsx: this.DEFAULT_OPTIONS.jsx,
      module: this.DEFAULT_OPTIONS.module,
      moduleResolution: this.DEFAULT_OPTIONS.moduleResolution,
      resolveJsonModule: this.DEFAULT_OPTIONS.resolveJsonModule,
      strict: this.DEFAULT_OPTIONS.strict,
      noEmit: this.DEFAULT_OPTIONS.noEmit,
      noEmitHelpers: this.DEFAULT_OPTIONS.noEmitHelpers
    };
  }

  create(info: ts_module.server.PluginCreateInfo): ts_module.LanguageService {
    this.info = info;

    const directory = info.project.getCurrentDirectory();

    // TypeScript plugins have a `cwd` of `/`, which causes issues with import resolution.
    process.chdir(directory);

    logger = Logger.forPlugin(info);

    logger.info(`Create typescript-deno-plugin`);
    const getCompilationSettings = info.languageServiceHost
      .getCompilationSettings.bind(
        info.languageServiceHost
      );
    const getScriptFileNames = info.languageServiceHost.getScriptFileNames
      .bind(
        info.languageServiceHost
      );
    // ref https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API#customizing-module-resolution
    const resolveModuleNames = info.languageServiceHost.resolveModuleNames
      ?.bind(
        info.languageServiceHost
      );
    const getSemanticDiagnostics = info.languageService.getSemanticDiagnostics
      .bind(
        info.languageService
      );

    info.languageServiceHost.getCompilationSettings = () => {
      const projectConfig = getCompilationSettings();

      if (!this.config.enable) {
        return projectConfig;
      }

      const compilationSettings = merge(
        merge(this.DEFAULT_OPTIONS, projectConfig),
        this.MUST_OVERWRITE_OPTIONS
      );

      logger
        .info(`compilationSettings:${JSON.stringify(compilationSettings)}`);
      return compilationSettings;
    };

    info.languageServiceHost.getScriptFileNames = () => {
      const scriptFileNames = getScriptFileNames();

      if (!this.config.enable) {
        return scriptFileNames;
      }

      let dtsFilepaths = getDtsPathForPluginConfig(info, this.config);

      if (!dtsFilepaths.length) {
        dtsFilepaths = getGlobalDtsPath();
      }

      for (const filepath of dtsFilepaths) {
        scriptFileNames.push(filepath);
        logger.info(`load dts filepath: ${filepath}`);
      }

      return scriptFileNames;
    };

    info.languageService.getSemanticDiagnostics = (filename: string) => {
      const diagnostics = getSemanticDiagnostics(filename);

      if (!this.config.enable) {
        return diagnostics;
      }

      const ignoreCodeMapInDeno: { [k: number]: boolean; } = {
        // 2691: true, // can not import module which end with `.ts`
        1308: true // support top level await 只允许在异步函数中使用 "await" 表达式
      };

      return diagnostics.filter(v => {
        return !ignoreCodeMapInDeno[v.code];
      });
    };

    if (!resolveModuleNames) {
      logger.info("resolveModuleNames is undefined.");
      return info.languageService;
    }

    info.languageServiceHost.resolveModuleNames = (
      moduleNames: string[],
      containingFile: string,
      reusedNames?: string[],
      redirectedReference?: ts_module.ResolvedProjectReference
    ): (ts_module.ResolvedModule | undefined)[] => {
      if (!this.config.enable) {
        return resolveModuleNames(
          moduleNames,
          containingFile,
          reusedNames,
          redirectedReference,
          {}
        );
      }

      const isResolveInDenoModule = containingFile.indexOf(getDenoDir()) === 0;

      let importMaps: IImportMap;

      //  try resolve import maps
      if (this.config.import_map) {
        const importMapsFilepath = path.isAbsolute(this.config.import_map)
          ? this.config.import_map
          : path.resolve(
            this.config.workspaceDir || process.cwd(),
            this.config.import_map
          );

        if (this.typescript.sys.fileExists(importMapsFilepath)) {
          const importMapContent = this.typescript.sys.readFile(
            importMapsFilepath
          );

          try {
            importMaps = JSON.parse(importMapContent || "{}");
          } catch {
          }
        }
      }

      const originModuleNames = moduleNames // resolve module from Import Maps
        .// eg. `import_map.json`
        // {
        //   "imports": {
        //     "http/": "https://deno.land/std/http/"
        //   }
        // }
        // resolve `http/server.ts` -> `https://deno.land/std/http/server.ts`
        map(name => resolveImportMap(
          importMaps,
          name
        )) // cover `https://example.com/mod.ts` -> `$DENO_DIR/deps/https/example.com/mod.ts`
        .map(convertRemoteToLocalCache) // if module is ESM. Then the module name may contain url query and url hash
        .// We need to remove it
        map(trimQueryAndHashFromPath) // for ESM support
        .// Some modules do not specify the domain name, but the root directory of the domain name
        // eg. `$DENO_DIR/deps/https/dev.jspm.io/react`
        // import { dew } from "/npm:react@16.12.0/index.dew.js";
        // export default dew();
        // import "/npm:react@16.12.0/cjs/react.development.dew.js";
        // import "/npm:object-assign@4?dew";
        // import "/npm:prop-types@15/checkPropTypes?dew";
        map(resolveFromDenoDir(isResolveInDenoModule, containingFile));

      moduleNames = originModuleNames.map(stripExtNameDotTs);

      const result = resolveModuleNames(
        moduleNames,
        containingFile,
        reusedNames,
        redirectedReference,
        {}
      );

      return result.map((v, index) => {
        if (!v) {
          info.languageServiceHost
            .getResolvedModuleWithFailedLookupLocationsFromCache;

          let originModuleName = originModuleNames[index];
          // import * as React from 'https://dev.jspm.io/react'
          if (
            path.isAbsolute(originModuleName) &&
            this.typescript.sys.fileExists(originModuleName)
          ) {
            return {
              extension: this.typescript.Extension.Js,
              isExternalLibraryImport: false,
              resolvedFileName: originModuleName
            } as ts_module.ResolvedModuleFull;
          }

          return v;
        }
        // const originModuleName = originModuleNames[index];
        // const originExtName = path.extname(originModuleName);
        // const resolveExtName = path.extname(v.resolvedFileName);

        // const realModuleAbsoluteFilepath = v.resolvedFileName.replace(
        //   new RegExp(resolveExtName + "$"),
        //   originExtName
        // );

        // // if `import './a.ts'` but resolve to `./a.js`
        // // so we think this module doesn't exist
        // if (v.resolvedFileName !== realModuleAbsoluteFilepath) {
        //   v.resolvedFileName = realModuleAbsoluteFilepath;
        // }

        // @ts-ignore
        const extension: string = v["extension"];
        if (extension) {
          const ts = this.typescript;
          // If the extension is the following
          // replace it with `json` so that no error is reported
          if (
            [
              ts.Extension.Ts,
              ts.Extension.Tsx,
              ts.Extension.Js,
              ts.Extension.Jsx
            ].includes(extension as ts_module.Extension)
          ) {
            // @ts-ignore
            v["extension"] = this.typescript.Extension.Json;
          }
        }

        return v;
      });
    };

    return info.languageService;
  }

  onConfigurationChanged(c: IConfig) {
    logger.info(`onConfigurationChanged: ${JSON.stringify(c)}`);
    this.config = merge(this.config, c);
    this.config.dtsFilepaths = c.dtsFilepaths;

    if (this.info) {
      this.info.project.refreshDiagnostics();
      this.info.project.updateGraph();
    }
  }
}

function getModuleWithQueryString(moduleName: string): string | undefined {
  let name = moduleName;
  for (
    const index = name.indexOf("?"); index !== -1; name = name
      .substring(index + 1)
  ) {
    if (name.substring(0, index).endsWith(".ts")) {
      const cutLength = moduleName.length - name.length;
      return moduleName.substring(0, index + cutLength);
    }
  }
}

function resolveImportMap(importMaps: IImportMap, moduleName: string): string {
  if (!importMaps) {
    return moduleName;
  }
  const maps = importMaps.imports || {};

  for (const prefix in maps) {
    const mapModule = maps[prefix];

    const reg = new RegExp("^" + prefix);
    if (reg.test(moduleName)) {
      moduleName = moduleName.replace(reg, mapModule);
    }
  }

  return moduleName;
}

function stripExtNameDotTs(moduleName: string): string {
  const moduleWithQuery = getModuleWithQueryString(moduleName);
  if (moduleWithQuery) {
    return moduleWithQuery;
  }
  if (TYPESCRIPT_EXT_REG.test(moduleName) === false) {
    return moduleName;
  }
  const name = moduleName.replace(TYPESCRIPT_EXT_REG, "");
  logger.info(`strip "${moduleName}" to "${name}".`);
  return name;
}

function convertRemoteToLocalCache(moduleName: string): string {
  if (!/^https?:\/\//.test(moduleName)) {
    return moduleName;
  }

  const denoDir = getDenoDir();
  // "https://deno.land/x/std/log/mod" to "$DENO_DIR/deps/https/deno.land/x/std/log/mod" (no ".ts" because stripped)
  let filepath = path.resolve(denoDir, "deps", moduleName.replace("://", "/"));

  if (!existsSync(filepath)) {
    const headersPath = `${filepath}.headers.json`;
    if (existsSync(headersPath)) {
      const headers: IDenoModuleHeaders = JSON.parse(
        fs.readFileSync(headersPath, { encoding: "utf-8" })
      );
      if (moduleName !== headers.redirect_to) {
        const redirectFilepath =
          convertRemoteToLocalCache(headers.redirect_to);
        logger.info(`redirect "${filepath}" to "${redirectFilepath}".`);
        filepath = redirectFilepath;
      }
    }
  }

  logger.info(`convert "${moduleName}" to "${filepath}".`);

  return filepath;
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

function resolveFromDenoDir(
  isResolveInDenoModule: boolean,
  currentFileAbsolutePath: string
) {
  return (moduleName: string): string => {
    if (isResolveInDenoModule && moduleName.indexOf("/") === 0) {
      const paths = moduleName.split("/");

      const denoDepsFilepath = path.join(getDenoDir(), "deps");

      paths.shift(); // remove `/` prefix of url path

      const urlPaths = currentFileAbsolutePath
        .replace(denoDepsFilepath, "")
        .split(path.sep);

      urlPaths.shift(); // remove prefix of filepath `path.sep`

      const protocol = urlPaths[0];
      const domainName = urlPaths[1];

      return path.join(denoDepsFilepath, protocol, domainName, ...paths);
    }
    return moduleName;
  };
}

function getDtsPathForPluginConfig(
  info: ts.server.PluginCreateInfo,
  config: IConfig
): string[] {
  const dtsFilepaths = config.dtsFilepaths || [];

  const projectDir = info.project.getCurrentDirectory();

  return dtsFilepaths
    .map(filepath => {
      const absFilepath = path.isAbsolute(filepath)
        ? filepath
        : path.resolve(projectDir, filepath);

      if (existsSync(absFilepath)) {
        return absFilepath;
      }
      return "";
    })
    .filter(v => v.endsWith(".d.ts"));
}

function getGlobalDtsPath(): string[] {
  const denoDir = getDenoDir();
  const globalDtsPath = path.resolve(denoDir, "lib.deno_runtime.d.ts");

  if (existsSync(globalDtsPath)) {
    return [globalDtsPath];
  }

  return [];
}

module.exports = function init({
  typescript
}: {
  typescript: typeof ts_module;
}) {
  const plugin = new DenoPlugin(typescript);

  return plugin;
};

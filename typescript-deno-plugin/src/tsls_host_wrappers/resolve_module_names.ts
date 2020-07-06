import ts_module, {
  LanguageServiceHost,
  ResolvedModuleFull,
} from "typescript/lib/tsserverlibrary";
import { Logger } from "logger";
import {
  parseImportMapFromFile,
  parseModuleName,
  resolveDenoModule,
} from "../utils";
import { getImportModules } from "../deno_modules";
import { universalModuleResolver } from "../module_resolver/universal_module_resolver";

export default function resolveModuleNamesWrapper(
  tsLsHost: LanguageServiceHost,
  logger: Logger,
  config: any,
  typescript: typeof ts_module,
  projectDirectory: string,
) {
  const originalResolveModuleNames = tsLsHost.resolveModuleNames;
  if (!originalResolveModuleNames) {
    return;
  }

  const resolveModuleNames: typeof tsLsHost.resolveModuleNames = (
    moduleNames: string[],
    containingFile: string,
    ...rest
  ) => {
    logger.info("resolveModuleNames");
    if (!config.enable) {
      logger.info("plugin disabled.");
      return originalResolveModuleNames.call(
        tsLsHost,
        moduleNames,
        containingFile,
        ...rest,
      );
    }

    const resolvedModules: (ResolvedModuleFull | undefined)[] = [];

    const parsedImportMap = parseImportMapFromFile(
      projectDirectory,
      config.importmap,
    );

    const content = typescript.sys.readFile(containingFile, "utf8");

    // handle @deno-types
    if (content && content.indexOf("// @deno-types=") >= 0) {
      const sourceFile = typescript.createSourceFile(
        containingFile,
        content,
        typescript.ScriptTarget.ESNext,
        true,
      );

      const modules = getImportModules(sourceFile);

      for (const m of modules) {
        if (m.hint) {
          const index = moduleNames.findIndex((v) => v === m.moduleName);
          moduleNames[index] = m.hint.text;
        }
      }
    }

    // try resolve typeReferenceDirectives
    for (let moduleName of moduleNames) {
      const parsedModuleName = parseModuleName(
        moduleName,
        containingFile,
        parsedImportMap,
        logger,
      );

      if (parsedModuleName == null) {
        logger.info(`module "${moduleName}" can not parsed`);
        resolvedModules.push(undefined);
        continue;
      }

      const resolvedModule = resolveDenoModule(parsedModuleName);

      if (!resolvedModule) {
        logger.info(`module "${moduleName}" can not resolved`);
        resolvedModules.push(undefined);
        continue;
      }

      logger.info(`module "${moduleName}" -> ${resolvedModule.filepath}`);

      resolvedModules.push({
        extension: resolvedModule.extension as ts_module.Extension,
        isExternalLibraryImport: false,
        resolvedFileName: resolvedModule.filepath,
      });

      const content = typescript.sys.readFile(resolvedModule.filepath);

      if (!content) {
        continue;
      }

      const { typeReferenceDirectives } = typescript.preProcessFile(
        content,
        true,
        true,
      );

      if (!typeReferenceDirectives.length) {
        continue;
      }

      for (const typeRef of typeReferenceDirectives) {
        const module = universalModuleResolver.resolve(
          typeRef.fileName,
          containingFile,
        );
        if (module) {
          resolvedModule.originModuleName = module.originModuleName;
          resolvedModule.filepath = module.filepath;
        }
      }
    }

    return resolvedModules;
  };

  return resolveModuleNames;
}

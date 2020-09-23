import path from "path";

import typescript from "typescript/lib/tsserverlibrary";
import { Logger } from "./logger";

import { ModuleResolver } from "../../core/module_resolver";
import { getImportModules } from "../../core/deno_deps";
import { isUntitledDocument } from "../../core/util";

export class DenoPlugin {
  constructor(private ts: typeof typescript) {}

  static readonly PLUGIN_NAME = "typescript-deno-plugin";

  private logger!: Logger;
  private proxy!: typescript.LanguageService;
  private oldLS!: typescript.LanguageService;

  create(info: typescript.server.PluginCreateInfo): typescript.LanguageService {
    function getRealPath(filepath: string): string {
      return info.project.realpath ? info.project.realpath(filepath) : filepath;
    }
    this.logger = Logger.forPlugin(DenoPlugin.PLUGIN_NAME, info);
    this.logger.info("TDP creating started");

    this.oldLS = info.languageService;
    this.program = this.ts.createProgram({
      rootNames: this.oldLS
        .getProgram()!!
        .getSourceFiles()
        .map((it) => getRealPath(it.fileName)),
      options: this.oldLS.getProgram()!!.getCompilerOptions(),
    });

    // Set up decorator
    this.proxy = Object.create(null);
    for (let k of Object.keys(info.languageService) as Array<
      keyof ts.LanguageService
    >) {
      const x: any = info.languageService[k];
      this.proxy[k] = (...args: any) =>
        x.apply(info.languageService, args) as any;
    }

    this.proxy.getProgram = () => {
      const old_program = this.oldLS.getProgram();

      this.logger.info(
        "getprogram: " +
          JSON.stringify(info.languageServiceHost.getScriptFileNames())
      );

      const new_program = this.ts.createProgram({
        rootNames: info.languageServiceHost
          .getScriptFileNames()
          .map((it) => getRealPath(it)),
        options: info.languageServiceHost.getCompilationSettings(),
        oldProgram: old_program,
      });
      this.program = new_program;
      return new_program;
    };

    if (info.languageServiceHost.resolveModuleNames) {
      info.languageServiceHost.resolveModuleNames = (
        moduleNames: string[],
        containingFile: string
      ): (
        | typescript.ResolvedModule
        | typescript.ResolvedModuleFull
        | undefined
      )[] => {
        // TODO: enable conditionally

        // containingFile may be `untitled: ^ Untitled-1`
        const realContainingFile = isUntitledDocument(containingFile)
          ? path.join(info.project.getCurrentDirectory(), "untitled")
          : // in Windows.
            // containingFile may be a unix-like style
            // eg. c:/Users/admin/path/to/file.ts
            // This is not a legal file path in Windows
            // It will cause a series of bugs, so here we get the real file path
            getRealPath(containingFile);

        // const importMapsFilepath = this.configurationManager.config.import_map
        //   ? path.isAbsolute(this.configurationManager.config.import_map)
        //     ? this.configurationManager.config.import_map
        //     : path.resolve(
        //         project.getCurrentDirectory(),
        //         this.configurationManager.config.import_map
        //       )
        //   : undefined;

        const resolver = ModuleResolver.create(
          realContainingFile
          // importMapsFilepath
        );

        const content = this.ts.sys.readFile(containingFile, "utf8");

        // handle @deno-types
        if (content && content.indexOf("// @deno-types=") >= 0) {
          const sourceFile = this.ts.createSourceFile(
            containingFile,
            content,
            this.ts.ScriptTarget.ESNext,
            true
          );

          const modules = getImportModules(this.ts)(sourceFile);

          for (const m of modules) {
            if (m.hint) {
              const index = moduleNames.findIndex((v) => v === m.moduleName);

              moduleNames[index] = m.hint.text;
            }
          }
        }

        const resolvedModules = resolver.resolveModules(moduleNames);

        // try resolve typeReferenceDirectives
        for (const resolvedModule of resolvedModules) {
          if (!resolvedModule) {
            continue;
          }

          const content = this.ts.sys.readFile(resolvedModule.filepath);

          if (!content) {
            continue;
          }

          const { typeReferenceDirectives } = this.ts.preProcessFile(
            content,
            true,
            true
          );

          if (!typeReferenceDirectives.length) {
            continue;
          }

          const _resolver = ModuleResolver.create(
            resolvedModule.filepath
            // importMapsFilepath
          );

          const modules = _resolver.resolveModules(
            typeReferenceDirectives.map((v) => v.fileName)
          );

          for (const m of modules) {
            if (m) {
              resolvedModule.origin = m.origin;
              resolvedModule.filepath = m.filepath;
            }
          }
        }

        return resolvedModules.map((v) => {
          if (!v) {
            return v;
          }

          const result: typescript.ResolvedModuleFull = {
            extension: v.extension as typescript.Extension,
            isExternalLibraryImport: false,
            resolvedFileName: v.filepath,
          };

          return result;
        });
      };
    }

    this.logger.info("TDP created.");
    return this.proxy;
  }

  getProxyLS(): typescript.LanguageService {
    return this.proxy;
  }

  private program!: typescript.Program;

  getProgram(): typescript.Program {
    this.logger.info(
      this.program
        .getSourceFiles()
        .map((it) => it.fileName)
        .reduce((p, c) => `${p}\n${c}`, "TDP Loaded source files: \n")
    );
    return this.program;
  }
}

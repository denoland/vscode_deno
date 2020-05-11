import ts_module from "typescript/lib/tsserverlibrary";
import merge from "merge-deep";

import { LanguageServiceHost } from "./language_service_host";
import { Logger } from "./logger";
import {
  getDenoDtsPath,
} from "./utils";

// see https://github.com/denoland/deno/blob/2debbdacb935cfe1eb7bb8d1f40a5063b339d90b/js/compiler.ts#L159-L170
const OPTIONS: ts_module.CompilerOptions = {
  allowJs: true,
  checkJs: true,
  esModuleInterop: true,
  module: ts_module.ModuleKind.ESNext,
  moduleResolution: ts_module.ModuleResolutionKind.NodeJs,
  jsx: ts_module.JsxEmit.React,
  noEmit: true,
  strict: true,
  outDir: "$deno$",
  removeComments: true,
  stripComments: true,
  resolveJsonModule: true,
  sourceMap: true,
  target: ts_module.ScriptTarget.ESNext,
  typeRoots: [],
};

const OPTIONS_OVERWRITE_BY_DENO: ts_module.CompilerOptions = {
  allowNonTsExtensions: false,
  jsx: OPTIONS.jsx,
  module: OPTIONS.module,
  moduleResolution: OPTIONS.moduleResolution,
  resolveJsonModule: OPTIONS.resolveJsonModule,
  strict: OPTIONS.strict,
  noEmit: OPTIONS.noEmit,
  noEmitHelpers: OPTIONS.noEmitHelpers,
  target: ts_module.ScriptTarget.ESNext,
  paths: {
    abc: ["./c.ts"],
    "abc.ts": ["./c.ts"],
  },
};

/**
 * An implementation of a `LanguageServiceHost` for a TypeScript project.
 *
 * The `TypeScriptServiceHost` implements the Deno `LanguageServiceHost` using
 * the TypeScript language services.
 */
export class TypeScriptServiceHost implements LanguageServiceHost {
  constructor(
    readonly tsLsHost: ts_module.LanguageServiceHost,
    // private readonly tsLS: ts_module.LanguageService,
    private readonly logger: Logger,
  ) {}

  getCompilationSettings(): ts_module.CompilerOptions {
    this.logger.info("getCompilationSettings");
    const projectConfig = this.tsLsHost.getCompilationSettings();
    const compilationSettings = merge(
      merge(OPTIONS, projectConfig),
      OPTIONS_OVERWRITE_BY_DENO,
    );
    compilationSettings.baseUrl = this.tsLsHost.getCurrentDirectory();
    this.logger.info(
      `compilationSettings:${JSON.stringify(compilationSettings)}`,
    );
    return compilationSettings;
  }

  resolveModuleNames(
    moduleNames: string[],
    containingFile: string,
    reusedNames: string[] | undefined,
    redirectedReference: ts_module.ResolvedProjectReference | undefined,
    options: ts_module.CompilerOptions,
  ): (ts_module.ResolvedModule | undefined)[] {
    if (!this.tsLsHost.resolveModuleNames) {
      this.logger.info("resolveModuleNames is undefined.");
      return [];
    }

    this.logger.info(
      "resolvedModule:\n" + JSON.stringify(moduleNames, null, "  "),
    );

    const resolvedModule = this.tsLsHost.resolveModuleNames(
      moduleNames,
      containingFile,
      reusedNames,
      redirectedReference,
      options,
    );

    return resolvedModule;
  }

  getScriptFileNames(): string[] {
    const scriptFileNames: string[] = this.tsLsHost.getScriptFileNames();

    const denoDtsPath = getDenoDtsPath(this.tsLsHost, "lib.deno.d.ts");

    if (denoDtsPath) {
      scriptFileNames.push(denoDtsPath);
    }

    return scriptFileNames;
  }

  // TODO
  resolveTypeReferenceDirectives(
    typeDirectiveNames: string[],
    containingFile: string,
    redirectedReference: ts_module.ResolvedProjectReference | undefined,
    options: ts_module.CompilerOptions,
  ): (ts_module.ResolvedTypeReferenceDirective | undefined)[] {
    if (!this.tsLsHost.resolveTypeReferenceDirectives) {
      return [];
    }

    return this.tsLsHost.resolveTypeReferenceDirectives(
      typeDirectiveNames,
      containingFile,
      redirectedReference,
      options,
    );
  }
}

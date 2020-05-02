import ts_module from "typescript/lib/tsserverlibrary";

/**
 * The host for a `LanguageService`. This provides all the `LanguageService` requires to respond
 * to the `LanguageService` requests.
 *
 * This interface describes the requirements of the `LanguageService` on its host.
 *
 * The host interface is host language agnostic.
 */
export interface LanguageServiceHost {
  /**
   * TODO: add comment
   */
  getCompilationSettings(fileName: string): ts_module.CompilerOptions;

  /**
   * TODO: add comment
   */
  resolveModuleNames(
    moduleNames: string[],
    containingFile: string,
    reusedNames: string[] | undefined,
    redirectedReference: ts_module.ResolvedProjectReference | undefined,
    options: ts_module.CompilerOptions,
  ): (ts_module.ResolvedModule | undefined)[];

  /**
   * TODO: add comment
   */
  getScriptFileNames(): string[];

  /**
   * TODO: add comment
   */
  resolveTypeReferenceDirectives(
    typeDirectiveNames: string[],
    containingFile: string,
    redirectedReference: ts_module.ResolvedProjectReference | undefined,
    options: ts_module.CompilerOptions,
  ): (ts_module.ResolvedTypeReferenceDirective | undefined)[];
}

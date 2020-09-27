// @ts-nocheck
import { TDPConfigMgr } from "./config";
import { Logger } from "./logger";
import clone from "clone";
import { normalizeImportStatement } from "../../core/deno_normalize_import_statement";
import { normalizeFilepath } from "../../core/util";
import path from "path";
import { CacheModule } from "../../core/deno_cache";
import tss, {
  CodeFixAction,
  FormatCodeSettings,
  UserPreferences,
} from "typescript/lib/tsserverlibrary";

export class DenoLanguageServer {
  private constructor(
    private original_host: tss.LanguageService,
    private new_host: tss.LanguageService
  ) {}

  static decorate(
    configMgr: TDPConfigMgr,
    service: tss.LanguageService,
    logger: Logger
  ): DenoLanguageServer {
    const new_service: tss.LanguageService = clone(service, true, 1);

    // start decorate

    new_service.getSemanticDiagnostics = (filename: string) => {
      const diagnostics = service.getSemanticDiagnostics(filename);

      if (!configMgr.getPluginConfig()?.enable) {
        return diagnostics;
      }

      // ref: https://github.com/denoland/deno/blob/da8cb408c878aa6e90542e26173f1f14b5254d29/cli/js/compiler/util.ts#L262
      const ignoredDiagnostics = [
        // TS2306: File 'file:///Users/rld/src/deno/cli/tests/subdir/amd_like.js' is
        // not a module.
        2306,
        // TS1375: 'await' expressions are only allowed at the top level of a file
        // when that file is a module, but this file has no imports or exports.
        // Consider adding an empty 'export {}' to make this file a module.
        1375,
        // TS1103: 'for-await-of' statement is only allowed within an async function
        // or async generator.
        1103,
        // TS2691: An import path cannot end with a '.ts' extension. Consider
        // importing 'bad-module' instead.
        2691,
        // TS5009: Cannot find the common subdirectory path for the input files.
        5009,
        // TS5055: Cannot write file
        // 'http://localhost:4545/cli/tests/subdir/mt_application_x_javascript.j4.js'
        // because it would overwrite input file.
        5055,
        // TypeScript is overly opinionated that only CommonJS modules kinds can
        // support JSON imports.  Allegedly this was fixed in
        // Microsoft/TypeScript#26825 but that doesn't seem to be working here,
        // so we will ignore complaints about this compiler setting.
        5070,
        // TS7016: Could not find a declaration file for module '...'. '...'
        // implicitly has an 'any' type.  This is due to `allowJs` being off by
        // default but importing of a JavaScript module.
        7016,
      ];

      const ignoredCompileDiagnostics = [
        // TS1208: All files must be modules when the '--isolatedModules' flag is
        // provided.  We can ignore because we guarantuee that all files are
        // modules.
        1208,
      ];

      return diagnostics.filter(
        (v) =>
          !ignoredDiagnostics.includes(v.code) &&
          !(
            configMgr.getProjectConfig()?.unstable &&
            ignoredCompileDiagnostics.includes(v.code)
          )
      );
    };

    new_service.getCodeFixesAtPosition = (
      fileName: string,
      start: number,
      end: number,
      errorCodes: readonly number[],
      formatOptions: FormatCodeSettings,
      preferences: UserPreferences
    ): readonly CodeFixAction[] => {
      const fixActions = service.getCodeFixesAtPosition(
        fileName,
        start,
        end,
        errorCodes,
        formatOptions,
        preferences
      );

      if (!configMgr.getPluginConfig()?.enable) {
        return fixActions;
      }

      for (const action of fixActions) {
        if (action.fixName === "import") {
          for (const change of action.changes) {
            for (const tc of change.textChanges) {
              tc.newText = normalizeImportStatement(
                fileName,
                tc.newText,
                logger
              );
            }
          }
        }
      }

      return fixActions;
    };

    new_service.getCodeFixesAtPosition = (
      fileName: string,
      start: number,
      end: number,
      errorCodes: readonly number[],
      formatOptions: FormatCodeSettings,
      preferences: UserPreferences
    ): readonly CodeFixAction[] => {
      const fixActions = service.getCodeFixesAtPosition(
        fileName,
        start,
        end,
        errorCodes,
        formatOptions,
        preferences
      );

      if (!configMgr.getPluginConfig()?.enable) {
        return fixActions;
      }

      for (const action of fixActions) {
        if (action.fixName === "import") {
          for (const change of action.changes) {
            for (const tc of change.textChanges) {
              tc.newText = normalizeImportStatement(
                fileName,
                tc.newText,
                logger
              );
            }
          }
        }
      }

      return fixActions;
    };

    new_service.getCompletionEntryDetails = (
      fileName: string,
      position: number,
      name: string,
      formatOptions?: tss.FormatCodeOptions | tss.FormatCodeSettings,
      source?: string,
      preferences?: tss.UserPreferences
    ) => {
      const details = service.getCompletionEntryDetails(
        fileName,
        position,
        name,
        formatOptions,
        source,
        preferences
      );

      if (!configMgr.getPluginConfig()?.enable) {
        return details;
      }

      if (details) {
        // modifiers maybe contain multiple values. eg `export,declare`
        const modifiers = details.kindModifiers.split(",") || [];

        if (
          modifiers.includes("export") &&
          details.codeActions &&
          details.codeActions.length
        ) {
          for (const ca of details.codeActions) {
            for (const change of ca.changes) {
              if (!change.isNewFile) {
                for (const tc of change.textChanges) {
                  tc.newText = normalizeImportStatement(
                    fileName,
                    tc.newText,
                    logger
                  );
                }
              }
            }
          }
        }

        if (details.source && details.source.length) {
          for (const source of details.source) {
            if (source.kind === "text") {
              // text is always unix style
              const text = source.text;

              const absoluteFilepath = path.resolve(
                normalizeFilepath(path.dirname(fileName)),
                normalizeFilepath(text)
              );

              if (path.isAbsolute(absoluteFilepath)) {
                const denoCache = CacheModule.create(absoluteFilepath, logger);

                if (denoCache) {
                  source.text = denoCache.meta.url.href;
                }
              }
            }
          }
        }
      }

      return details;
    };
    // end decorate

    return new DenoLanguageServer(service, new_service);
  }
  getOriginalOne(): tss.LanguageService {
    return this.original_host;
  }
  getNewOne(): tss.LanguageService {
    return this.new_host;
  }
}

import ts_module, {
	LanguageService,
  Diagnostic,
} from "typescript/lib/tsserverlibrary";
import { Logger } from "../logger";
import { 
  parseImportMapFromFile,
  parseModuleName,
  resolveDenoModule,
  isHttpURL
} from "../utils";
import { ImportMaps } from "import-maps";
import path from "path";

export default function getSemanticDiagnosticsWrapper(tsLs: LanguageService, config: any, logger: Logger, projectDirectory: string) {
    const getSemanticDiagnostics = (filename: string): Diagnostic[] => {
        logger.info("getSemanticDiagnostics");
        const diagnostics = tsLs.getSemanticDiagnostics(filename);

        let parsedImportMap: ImportMaps;

        if (!config.enable) {
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
          // !! 2691,
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

        return diagnostics.filter((d: ts_module.Diagnostic) =>
          !ignoredDiagnostics.includes(d.code)
        ).map((d: ts_module.Diagnostic) => {
          if (d.code === 2691) {
            const moduleName = d.file!.getFullText().substr(
              d.start! + 1,
              d.length! - 2,
            );

            if (config.importmap != null) {
              parsedImportMap = parseImportMapFromFile(
                projectDirectory,
                config.importmap,
              );
            }

            const parsedModuleName = parseModuleName(
              moduleName,
              d.file?.fileName!,
              parsedImportMap,
              logger,
            );

            if (parsedModuleName == null) {
              d.code = 10001; // InvalidRelativeImport
              d.messageText =
                `relative import path "${moduleName}" not prefixed with / or ./ or ../`;
              return d;
            }

            const resolvedModule = resolveDenoModule(parsedModuleName);

            if (resolvedModule != null) {
              return d;
            }

            if (isHttpURL(parsedModuleName)) {
              d.code = 10002; // RemoteModuleNotExist
              if (moduleName === parsedModuleName) {
                d.messageText =
                  `The remote module has not been cached locally. Try \`deno cache ${parsedModuleName}\` if it exists`;
              } else {
                d.messageText =
                  `The remote module "${moduleName}" has not been cached locally. Try \`deno cache ${parsedModuleName}\` if it exists`;
              }

              return d;
            }

            if (
              path.isAbsolute(parsedModuleName) ||
              parsedModuleName.startsWith("./") ||
              parsedModuleName.startsWith("../") ||
              parsedModuleName.startsWith("file://")
            ) {
              d.code = 10003; // LocalModuleNotExist
              d.messageText = `Could not find module "${moduleName}" locally`;
              return d;
            }

            d.code = 10004; // InvalidImport
            d.messageText =
              `Import module "${moduleName}" must be a relative path or remote HTTP URL`;
          }
          return d;
        });
	};

	return getSemanticDiagnostics;
}
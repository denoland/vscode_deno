// modified from https://github.com/Microsoft/typescript-tslint-plugin
import ts_module, {
  CompilerOptions,
} from "typescript/lib/tsserverlibrary";

import { Logger } from "./logger";

import "./code_fixes";
import { getTsUtils } from "./ts_utils";

import getCompletionsAtPositionWrapper from "./tsls_wrappers/completions";
import getCompletionEntryDetailsnWrapper from "./tsls_wrappers/completion_entry_details";
import getSemanticDiagnosticsWrapper from "./tsls_wrappers/semantic_diagnostics";
import getCodeFixesAtPositionWrapper from "./tsls_wrappers/code_fixes";

import resolveModuleNamesWrapper from "./tsls_host_wrappers/resolve_module_names";
import getCompilationSettingsWrapper from "./tsls_host_wrappers/compilation_settings";
import resolveTypeReferenceDirectivesWrapper from "./tsls_host_wrappers/resolve_type_reference_directives";
import getScriptFileNamesWrapper from "./tsls_host_wrappers/script_file_names";

let logger: Logger;
let pluginInfo: ts_module.server.PluginCreateInfo;

type DenoPluginConfig = {
  enable: boolean;
  importmap?: string;
  tsconfig?: string;
};

const config: DenoPluginConfig = {
  enable: true,
};

let projectDirectory: string;

module.exports = function init(
  { typescript }: { typescript: typeof ts_module },
) {
  // see https://github.com/denoland/deno/blob/2debbdacb935cfe1eb7bb8d1f40a5063b339d90b/js/compiler.ts#L159-L170
  const OPTIONS: CompilerOptions = {
    allowJs: true,
    checkJs: true,
    esModuleInterop: true,
    module: typescript.ModuleKind.ESNext,
    moduleResolution: typescript.ModuleResolutionKind.NodeJs,
    jsx: typescript.JsxEmit.React,
    noEmit: true,
    strict: true,
    outDir: "$deno$",
    removeComments: true,
    stripComments: true,
    resolveJsonModule: true,
    sourceMap: true,
    target: typescript.ScriptTarget.ESNext,
    typeRoots: [],
  };

  const OPTIONS_OVERWRITE_BY_DENO: CompilerOptions = {
    allowNonTsExtensions: false,
    jsx: OPTIONS.jsx,
    module: OPTIONS.module,
    moduleResolution: OPTIONS.moduleResolution,
    resolveJsonModule: OPTIONS.resolveJsonModule,
    strict: OPTIONS.strict,
    noEmit: OPTIONS.noEmit,
    noEmitHelpers: OPTIONS.noEmitHelpers,
    target: typescript.ScriptTarget.ESNext,
  };

  return {
    create(info: ts_module.server.PluginCreateInfo): ts_module.LanguageService {
      logger = Logger.forPlugin(info);
      logger.info("plugin created.");

      pluginInfo = info;
      const tsLs = info.languageService;
      const tsLsHost = info.languageServiceHost;
      const project = info.project;

      const tsUtils = getTsUtils(tsLs);

      Object.assign(config, info.config);

      if (!config.enable) {
        logger.info("plugin disabled.");
        return tsLs;
      }

      projectDirectory = project.getCurrentDirectory();
      // TypeScript plugins have a `cwd` of `/`, which causes issues with import resolution.
      process.chdir(projectDirectory);

      // ref https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API#customizing-module-resolution
      tsLsHost.resolveModuleNames = resolveModuleNamesWrapper(
        tsLsHost,
        logger,
        config,
        typescript,
        projectDirectory,
      );
      tsLsHost.resolveTypeReferenceDirectives =
        resolveTypeReferenceDirectivesWrapper(tsLsHost, config, logger);
      tsLsHost.getCompilationSettings = getCompilationSettingsWrapper(
        tsLsHost,
        config,
        OPTIONS,
        OPTIONS_OVERWRITE_BY_DENO,
      );
      tsLsHost.getScriptFileNames = getScriptFileNamesWrapper(
        tsLsHost,
        config,
        logger,
      );

      const getCompletionsAtPosition = getCompletionsAtPositionWrapper(
        projectDirectory,
        config,
        tsLs,
        tsUtils,
      );
      const getCompletionEntryDetails = getCompletionEntryDetailsnWrapper(
        tsLs,
        config,
      );
      const getSemanticDiagnostics = getSemanticDiagnosticsWrapper(
        tsLs,
        config,
        logger,
        projectDirectory,
      );
      // TODO(justjavac): maybe also `getCombinedCodeFix`
      const getCodeFixesAtPosition = getCodeFixesAtPositionWrapper(tsLs);

      const proxy: ts_module.LanguageService = {
        ...tsLs,

        getCompletionsAtPosition,
        getCompletionEntryDetails,
        getSemanticDiagnostics,
        getCodeFixesAtPosition,
      };

      return proxy;
    },

    onConfigurationChanged(c: DenoPluginConfig) {
      logger.info("config change to:\n" + JSON.stringify(c, null, "  "));
      Object.assign(config, c);

      pluginInfo.project.markAsDirty();
      pluginInfo.project.refreshDiagnostics();
      pluginInfo.project.updateGraph();
      pluginInfo.languageService.getProgram()?.emit();
    },
  };
};

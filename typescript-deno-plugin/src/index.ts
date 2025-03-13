// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

import type { PluginSettings } from "../../client/src/shared_types";
import type * as ts from "../node_modules/typescript/lib/tsserverlibrary";
import * as path from "path";
import * as process from "process";
import * as os from "os";
import { setImmediate } from "timers";
import * as util from "util";
import { isMatch } from "picomatch";

/** Extract the return type from a maybe function. */
// deno-lint-ignore no-explicit-any
type ReturnType<T = (...args: any) => any> = T extends // deno-lint-ignore no-explicit-any
(...args: any) => infer R ? R
  // deno-lint-ignore no-explicit-any
  : any;
/** Extract the parameter types from a maybe function. */
// deno-lint-ignore no-explicit-any
type Parameters<T = (...args: any) => any> = T extends // deno-lint-ignore no-explicit-any
(...args: infer P) => any ? P
  : never;

type CallIfDisabledFunction = <T extends ts.LanguageService, J extends keyof T>(
  fn: J,
  fileNameArg: number | undefined,
  enabledReturn: (() => ReturnType<T[J]>) | ReturnType<T[J]>,
) => (...args: Parameters<T[J]>) => ReturnType<T[J]>;

/** Contains the project settings that have been provided by the extension for
 * each workspace. */
const projectSettings = new Map<string, PluginSettings>();

class Plugin implements ts.server.PluginModule {
  #project!: ts.server.Project;
  #projectName!: string;

  // determines if a deno is enabled "globally" or not for those APIs which
  // don't reference a file name
  #denoEnabled(): boolean {
    const pluginSettings = projectSettings.get(this.#projectName);
    if (!pluginSettings) {
      return false;
    }
    const enableSettingsUnscoped = pluginSettings.enableSettingsUnscoped ??
      { enable: null, enablePaths: null, disablePaths: [] };
    const scopesWithDenoJson = pluginSettings.scopesWithDenoJson ?? [];
    if (enableSettingsUnscoped.enable != null) {
      return enableSettingsUnscoped.enable;
    }
    return scopesWithDenoJson.length != 0;
  }

  // determines if a specific filename is Deno enabled or not.
  #fileNameDenoEnabled(fileName: string): boolean {
    if (process.platform === "win32") {
      fileName = fileName.replace(/\//g, "\\");
    }
    fileName = fileName.replace(/^\^\/vscode-notebook-cell\/[^/]*/, "");
    const pluginSettings = projectSettings.get(this.#projectName);
    if (!pluginSettings) {
      return false;
    }
    const enableSettings =
      pluginSettings.enableSettingsByFolder?.find(([workspace, _]) =>
        pathStartsWith(fileName, workspace)
      )?.[1] ?? pluginSettings.enableSettingsUnscoped ??
        { enable: null, enablePaths: null, disablePaths: [] };
    const scopesWithDenoJson = pluginSettings.scopesWithDenoJson ?? [];
    if (isMatch(fileName, enableSettings.disablePaths)) return false;
    for (const path of enableSettings.disablePaths) {
      if (pathStartsWith(fileName, path)) {
        return false;
      }
    }
    if (enableSettings.enablePaths) {
      return isMatch(fileName, enableSettings.enablePaths) ||
        enableSettings.enablePaths.some((path) =>
          pathStartsWith(fileName, path)
        );
    }
    if (enableSettings.enable != null) {
      return enableSettings.enable;
    }
    return scopesWithDenoJson.some((scope) => pathStartsWith(fileName, scope));
  }

  #log = (..._msgs: unknown[]) => {};
  #loggingEnabled = () => true;

  create(info: ts.server.PluginCreateInfo): ts.LanguageService {
    const { languageService: ls, project, config } = info;
    this.#log = (...msgs) => {
      project.projectService.logger.info(
        `[typescript-deno-plugin] ${
          msgs.map((m) => typeof m === "string" ? m : util.inspect(m)).join(" ")
        }`,
      );
    };
    this.#loggingEnabled = () => {
      return project.projectService.logger.loggingEnabled();
    };

    this.#project = project;
    this.#projectName = project.getProjectName();
    projectSettings.set(this.#project.getProjectName(), config);
    setImmediate(() => {
      this.#project.refreshDiagnostics();
    });

    /** Given an object and a method name on that object, call if disabled. */
    const callIfDisabled: CallIfDisabledFunction = (
      fn,
      fileNameArg,
      emptyReturn,
    ) => {
      // deno-lint-ignore no-explicit-any
      const target = (ls as any)[fn];
      return (...args) => {
        if (this.#loggingEnabled()) {
          this.#log(fn, args);
        }
        const enabled = fileNameArg !== undefined
          ? this.#fileNameDenoEnabled(args[fileNameArg] as string)
          : this.#denoEnabled();
        return enabled
          // in order to keep the `emptyReturn` separate instances, we do some
          // analysis here to ensure we are returning a "fresh" `emptyReturn`
          ? Array.isArray(emptyReturn)
            ? []
            : typeof emptyReturn === "function"
            ? (emptyReturn as () => unknown)()
            : emptyReturn
          : target.call(ls, ...args);
      };
    };

    // This "mutes" diagnostics for things like tsconfig files.
    const projectGetGlobalProjectErrors = this.#project.getGlobalProjectErrors;
    this.#project.getGlobalProjectErrors = () =>
      this.#denoEnabled()
        ? []
        : projectGetGlobalProjectErrors.call(this.#project);
    const projectGetAllProjectErrors = this.#project.getAllProjectErrors;
    this.#project.getAllProjectErrors = () =>
      this.#denoEnabled() ? [] : projectGetAllProjectErrors.call(this.#project);

    const commentSelection = callIfDisabled("commentSelection", 0, []);
    const findReferences = callIfDisabled("findReferences", 0, undefined);
    const findRenameLocations = callIfDisabled(
      "findRenameLocations",
      0,
      undefined,
    ) as ts.LanguageService["findRenameLocations"];
    const getApplicableRefactors = callIfDisabled(
      "getApplicableRefactors",
      0,
      [],
    );
    const getBraceMatchingAtPosition = callIfDisabled(
      "getBraceMatchingAtPosition",
      0,
      [],
    );
    const getBreakpointStatementAtPosition = callIfDisabled(
      "getBreakpointStatementAtPosition",
      0,
      undefined,
    );
    const getCodeFixesAtPosition = callIfDisabled(
      "getCodeFixesAtPosition",
      0,
      [],
    );
    const getCompilerOptionsDiagnostics = callIfDisabled(
      "getCompilerOptionsDiagnostics",
      undefined,
      [],
    );
    const getCompletionEntryDetails = callIfDisabled(
      "getCompletionEntryDetails",
      0,
      undefined,
    );
    const getCompletionEntrySymbol = callIfDisabled(
      "getCompletionEntrySymbol",
      0,
      undefined,
    );
    const getCompletionsAtPosition = callIfDisabled(
      "getCompletionsAtPosition",
      0,
      undefined,
    );
    const getDefinitionAndBoundSpan = callIfDisabled(
      "getDefinitionAndBoundSpan",
      0,
      undefined,
    );
    const getDefinitionAtPosition = callIfDisabled(
      "getDefinitionAtPosition",
      0,
      undefined,
    );
    const getDocCommentTemplateAtPosition = callIfDisabled(
      "getDocCommentTemplateAtPosition",
      0,
      undefined,
    );
    const getDocumentHighlights = callIfDisabled(
      "getDocumentHighlights",
      0,
      undefined,
    );
    const getEditsForFileRename = callIfDisabled(
      "getEditsForFileRename",
      0,
      [],
    );
    const getEditsForRefactor = callIfDisabled(
      "getEditsForRefactor",
      0,
      undefined,
    );
    const getEncodedSemanticClassifications = callIfDisabled(
      "getEncodedSemanticClassifications",
      0,
      () => ({ spans: [], endOfLineState: 0 }),
    );
    const getEncodedSyntacticClassifications = callIfDisabled(
      "getEncodedSyntacticClassifications",
      0,
      () => ({ spans: [], endOfLineState: 0 }),
    );
    const getImplementationAtPosition = callIfDisabled(
      "getImplementationAtPosition",
      0,
      undefined,
    );
    const getJsxClosingTagAtPosition = callIfDisabled(
      "getJsxClosingTagAtPosition",
      0,
      undefined,
    );
    const getNameOrDottedNameSpan = callIfDisabled(
      "getNameOrDottedNameSpan",
      0,
      undefined,
    );
    const getNavigateToItems = callIfDisabled(
      "getNavigateToItems",
      undefined,
      [],
    );
    const getNavigationBarItems = callIfDisabled(
      "getNavigationBarItems",
      0,
      [],
    );
    const getNavigationTree = callIfDisabled("getNavigationTree", 0, () => ({
      text: "",
      kind: "" as ts.ScriptElementKind.unknown,
      kindModifiers: "",
      spans: [],
      nameSpan: undefined,
    }));
    const getOutliningSpans = callIfDisabled("getOutliningSpans", 0, []);
    const getQuickInfoAtPosition = callIfDisabled(
      "getQuickInfoAtPosition",
      0,
      undefined,
    );
    const getReferencesAtPosition = callIfDisabled(
      "getReferencesAtPosition",
      0,
      undefined,
    );
    const getSemanticClassifications = callIfDisabled(
      "getSemanticClassifications",
      0,
      [],
    ) as ts.LanguageService["getSemanticClassifications"];
    const getSemanticDiagnostics = callIfDisabled(
      "getSemanticDiagnostics",
      0,
      [],
    );
    const getSignatureHelpItems = callIfDisabled(
      "getSignatureHelpItems",
      0,
      undefined,
    );
    const getSpanOfEnclosingComment = callIfDisabled(
      "getSpanOfEnclosingComment",
      0,
      undefined,
    );
    const getSuggestionDiagnostics = callIfDisabled(
      "getSuggestionDiagnostics",
      0,
      [],
    );
    const getSyntacticDiagnostics = callIfDisabled(
      "getSyntacticDiagnostics",
      0,
      [],
    );
    const getSyntacticClassifications = callIfDisabled(
      "getSyntacticClassifications",
      0,
      [],
    ) as ts.LanguageService["getSyntacticClassifications"];
    const getTodoComments = callIfDisabled("getTodoComments", 0, []);
    const getTypeDefinitionAtPosition = callIfDisabled(
      "getTypeDefinitionAtPosition",
      0,
      undefined,
    );
    const prepareCallHierarchy = callIfDisabled(
      "prepareCallHierarchy",
      0,
      undefined,
    );
    const provideCallHierarchyIncomingCalls = callIfDisabled(
      "provideCallHierarchyIncomingCalls",
      0,
      [],
    );
    const provideCallHierarchyOutgoingCalls = callIfDisabled(
      "provideCallHierarchyOutgoingCalls",
      0,
      [],
    );
    const provideInlayHints = callIfDisabled("provideInlayHints", 0, []);
    const toggleLineComment = callIfDisabled("toggleLineComment", 0, []);
    const toggleMultilineComment = callIfDisabled(
      "toggleMultilineComment",
      0,
      [],
    );
    const uncommentSelection = callIfDisabled("uncommentSelection", 0, []);
    const getSupportedCodeFixes = callIfDisabled(
      "getSupportedCodeFixes",
      0,
      [],
    );

    return {
      ...ls,
      commentSelection,
      findReferences,
      findRenameLocations,
      getApplicableRefactors,
      getBraceMatchingAtPosition,
      getBreakpointStatementAtPosition,
      getCodeFixesAtPosition,
      getCompilerOptionsDiagnostics,
      getCompletionEntryDetails,
      getCompletionEntrySymbol,
      getCompletionsAtPosition,
      getDefinitionAndBoundSpan,
      getDefinitionAtPosition,
      getDocCommentTemplateAtPosition,
      getDocumentHighlights,
      getEditsForFileRename,
      getEditsForRefactor,
      getEncodedSemanticClassifications,
      getEncodedSyntacticClassifications,
      getImplementationAtPosition,
      getJsxClosingTagAtPosition,
      getNameOrDottedNameSpan,
      getNavigateToItems,
      getNavigationBarItems,
      getNavigationTree,
      getOutliningSpans,
      getQuickInfoAtPosition,
      getReferencesAtPosition,
      getSemanticClassifications,
      getSemanticDiagnostics,
      getSignatureHelpItems,
      getSpanOfEnclosingComment,
      getSuggestionDiagnostics,
      getSyntacticClassifications,
      getSyntacticDiagnostics,
      getTodoComments,
      getTypeDefinitionAtPosition,
      prepareCallHierarchy,
      provideCallHierarchyIncomingCalls,
      provideCallHierarchyOutgoingCalls,
      provideInlayHints,
      toggleLineComment,
      toggleMultilineComment,
      uncommentSelection,
      getSupportedCodeFixes,
    };
  }

  onConfigurationChanged(settings: PluginSettings): void {
    if (this.#loggingEnabled()) {
      this.#log(`onConfigurationChanged(${JSON.stringify(settings)})`);
    }
    projectSettings.set(this.#project.getProjectName(), settings);
    this.#project.refreshDiagnostics();
  }
}

function init(): ts.server.PluginModule {
  console.log(`INIT typescript-deno-plugin`);
  return new Plugin();
}

const PARENT_RELATIVE_REGEX = os.platform() === "win32"
  ? /\.\.(?:[/\\]|$)/
  : /\.\.(?:\/|$)/;

/** Checks if `parent` is an ancestor of `child`. */
function pathStartsWith(child: string, parent: string) {
  if (path.isAbsolute(child) !== path.isAbsolute(parent)) {
    return false;
  }
  const relative = path.relative(parent, child);
  return !relative.match(PARENT_RELATIVE_REGEX);
}

export = init;

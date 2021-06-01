// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.

import type { PluginSettings, Settings } from "../../client/src/interfaces";
import type * as ts from "../node_modules/typescript/lib/tsserverlibrary";

/** Extract the return type from a maybe function. */
// deno-lint-ignore no-explicit-any
type ReturnType<T = (...args: any) => any> = T extends // deno-lint-ignore no-explicit-any
(...args: any) => infer R ? R
  : // deno-lint-ignore no-explicit-any
  any;
/** Extract the parameter types from a maybe function. */
// deno-lint-ignore no-explicit-any
type Parameters<T = (...args: any) => any> = T extends // deno-lint-ignore no-explicit-any
(...args: infer P) => any ? P
  : never;

type CallIfDisabledFunction = <T extends ts.LanguageService, J extends keyof T>(
  fn: J,
  fileNameArg: number | undefined,
  enabledReturn: ReturnType<T[J]>,
) => (...args: Parameters<T[J]>) => ReturnType<T[J]>;

/** Contains the project settings that have been provided by the extension for
 * each workspace. */
const projectSettings = new Map<string, PluginSettings>();

/** The default settings to assume to be true until a configuration message is
 * received from the extension. */
const defaultSettings: Settings = {
  enable: false,
  codeLens: null,
  config: null,
  importMap: null,
  internalDebug: false,
  lint: false,
  suggest: {
    autoImports: true,
    completeFunctionCalls: false,
    names: true,
    paths: true,
    imports: {
      autoDiscover: true,
      hosts: {},
    },
  },
  unstable: false,
};

function updateSettings(
  project: ts.server.Project,
  settings: PluginSettings,
): void {
  projectSettings.set(project.getProjectName(), settings);
  // We will update the default settings, which helps ensure that when a plugin
  // is created or re-created, we can assume what the previous settings where
  // until told otherwise.
  Object.assign(defaultSettings, settings.workspace);
}

class Plugin implements ts.server.PluginModule {
  #project!: ts.server.Project;
  #projectName!: string;

  #getGlobalSettings = (): Settings => {
    return projectSettings.get(this.#projectName)?.workspace ??
      defaultSettings;
  };

  #getSetting = <K extends keyof Settings>(
    fileName: string,
    key: K,
  ): Settings[K] => {
    const settings = projectSettings.get(this.#projectName);
    return settings
      ? settings.documents[fileName]?.settings[key] ??
        // deno-lint-ignore no-explicit-any
        settings.workspace[key] as any
      : defaultSettings[key];
  };

  #log = (_msg: string) => {};

  create(info: ts.server.PluginCreateInfo): ts.LanguageService {
    const { languageService: ls, project } = info;
    this.#log = (msg) =>
      project.projectService.logger.info(`[typescript-deno-plugin] ${msg}`);

    this.#project = project;
    this.#projectName = project.getProjectName();

    /** Given an object and a method name on that object, call if disabled. */
    const callIfDisabled: CallIfDisabledFunction = (
      fn,
      fileNameArg,
      emptyReturn,
    ) => {
      // deno-lint-ignore no-explicit-any
      const target = (ls as any)[fn];
      return (...args) => {
        const enabled = fileNameArg !== undefined
          ? this.#getSetting(args[fileNameArg] as string, "enable")
          : this.#getGlobalSettings().enable;
        return enabled ? emptyReturn : target.call(ls, ...args);
      };
    };

    const commentSelection = callIfDisabled("commentSelection", 0, []);
    const findReferences = callIfDisabled("findReferences", 0, undefined);
    const findRenameLocations = callIfDisabled(
      "findRenameLocations",
      0,
      undefined,
    );
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
    const getImplementationAtPosition = callIfDisabled(
      "getImplementationAtPosition",
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
    const getTodoComments = callIfDisabled("getTodoComments", 0, []);
    const getTypeDefinitionAtPosition = callIfDisabled(
      "getTypeDefinitionAtPosition",
      0,
      undefined,
    );
    const organizeImports = callIfDisabled("organizeImports", undefined, []);
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
    const toggleLineComment = callIfDisabled("toggleLineComment", 0, []);
    const toggleMultilineComment = callIfDisabled(
      "toggleMultilineComment",
      0,
      [],
    );
    const uncommentSelection = callIfDisabled("uncommentSelection", 0, []);

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
      getImplementationAtPosition,
      getNameOrDottedNameSpan,
      getNavigateToItems,
      getNavigationBarItems,
      getOutliningSpans,
      getQuickInfoAtPosition,
      getReferencesAtPosition,
      getSemanticDiagnostics,
      getSignatureHelpItems,
      getSuggestionDiagnostics,
      getSyntacticDiagnostics,
      getTodoComments,
      getTypeDefinitionAtPosition,
      organizeImports,
      prepareCallHierarchy,
      provideCallHierarchyIncomingCalls,
      provideCallHierarchyOutgoingCalls,
      toggleLineComment,
      toggleMultilineComment,
      uncommentSelection,
    };
  }

  onConfigurationChanged(settings: PluginSettings): void {
    this.#log(`onConfigurationChanged(${JSON.stringify(settings)})`);
    updateSettings(this.#project, settings);
    this.#project.refreshDiagnostics();
  }
}

function init(): ts.server.PluginModule {
  console.log(`INIT typescript-deno-plugin`);
  return new Plugin();
}

export = init;

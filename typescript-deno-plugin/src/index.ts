// Copyright 2018-2020 the Deno authors. All rights reserved. MIT license.

import { around } from "./aspect";
import type { Parameters, ReturnType } from "./aspect";
import type { Settings } from "../../client/src/interfaces";
import type * as ts from "../node_modules/typescript/lib/tsserverlibrary";

type CallIfDisabledFunction = <T extends ts.LanguageService, J extends keyof T>(
  fn: J,
  enabledReturn: ReturnType<T[J]>,
) => (...args: Parameters<T[J]>) => ReturnType<T[J]>;

/** Contains the project settings that have been provided by the extension for
 * each workspace. */
const projectSettings = new Map<string, Settings>();

/** The default settings to assume to be true until a configuration message is
 * received from the extension. */
const defaultSettings: Settings = {
  enable: false,
  config: null,
  importMap: null,
  lint: false,
  unstable: false,
};

function getSettings(project: ts.server.Project): Settings {
  return projectSettings.get(project.getProjectName()) ?? defaultSettings;
}

function updateSettings(project: ts.server.Project, settings: Settings): void {
  projectSettings.set(project.getProjectName(), settings);
  // We will update the default settings, which helps ensure that when a plugin
  // is created or re-created, we can assume what the previous settings where
  // until told otherwise.
  Object.assign(defaultSettings, settings);
}

class Plugin implements ts.server.PluginModule {
  private log = (_msg: string) => {};
  private project!: ts.server.Project;

  create(info: ts.server.PluginCreateInfo): ts.LanguageService {
    const { languageService: ls, languageServiceHost: host, project } = info;
    this.log = (msg) =>
      project.projectService.logger.info(`[typescript-deno-plugin] ${msg}`);

    this.project = project;

    // We have to "monkey patch" the language service host to strip out
    // script file names, so the language service does less when extension is
    // enabled for the workspace.
    around(
      host,
      "getScriptFileNames",
      (fn) => getSettings(this.project).enable ? [] : fn(),
    );

    /** Given an object and a method name on that object, call if disabled. */
    const callIfDisabled: CallIfDisabledFunction = (fn, emptyReturn) => {
      const target = (ls as any)[fn];
      return (...args) => {
        if (getSettings(this.project).enable) {
          return emptyReturn;
        }
        return target.call(ls, ...args);
      };
    };

    const commentSelection = callIfDisabled("commentSelection", []);
    const findReferences = callIfDisabled("findReferences", undefined);
    const findRenameLocations = callIfDisabled(
      "findRenameLocations",
      undefined,
    );
    const getApplicableRefactors = callIfDisabled("getApplicableRefactors", []);
    const getBraceMatchingAtPosition = callIfDisabled(
      "getBraceMatchingAtPosition",
      [],
    );
    const getBreakpointStatementAtPosition = callIfDisabled(
      "getBreakpointStatementAtPosition",
      undefined,
    );
    const getCodeFixesAtPosition = callIfDisabled("getCodeFixesAtPosition", []);
    const getCompilerOptionsDiagnostics = callIfDisabled(
      "getCompilerOptionsDiagnostics",
      [],
    );
    const getCompletionEntryDetails = callIfDisabled(
      "getCompletionEntryDetails",
      undefined,
    );
    const getCompletionEntrySymbol = callIfDisabled(
      "getCompletionEntrySymbol",
      undefined,
    );
    const getCompletionsAtPosition = callIfDisabled(
      "getCompletionsAtPosition",
      undefined,
    );
    const getDefinitionAndBoundSpan = callIfDisabled(
      "getDefinitionAndBoundSpan",
      undefined,
    );
    const getDefinitionAtPosition = callIfDisabled(
      "getDefinitionAtPosition",
      undefined,
    );
    const getDocCommentTemplateAtPosition = callIfDisabled(
      "getDocCommentTemplateAtPosition",
      undefined,
    );
    const getDocumentHighlights = callIfDisabled(
      "getDocumentHighlights",
      undefined,
    );
    const getEditsForFileRename = callIfDisabled("getEditsForFileRename", []);
    const getEditsForRefactor = callIfDisabled(
      "getEditsForRefactor",
      undefined,
    );
    const getImplementationAtPosition = callIfDisabled(
      "getImplementationAtPosition",
      undefined,
    );
    const getNameOrDottedNameSpan = callIfDisabled(
      "getNameOrDottedNameSpan",
      undefined,
    );
    const getNavigateToItems = callIfDisabled("getNavigateToItems", []);
    const getNavigationBarItems = callIfDisabled("getNavigationBarItems", []);
    const getOutliningSpans = callIfDisabled("getOutliningSpans", []);
    const getQuickInfoAtPosition = callIfDisabled(
      "getQuickInfoAtPosition",
      undefined,
    );
    const getReferencesAtPosition = callIfDisabled(
      "getReferencesAtPosition",
      undefined,
    );
    const getSemanticDiagnostics = callIfDisabled("getSemanticDiagnostics", []);
    const getSignatureHelpItems = callIfDisabled(
      "getSignatureHelpItems",
      undefined,
    );
    const getSuggestionDiagnostics = callIfDisabled(
      "getSuggestionDiagnostics",
      [],
    );
    const getSyntacticDiagnostics = callIfDisabled(
      "getSyntacticDiagnostics",
      [],
    );
    const getTodoComments = callIfDisabled("getTodoComments", []);
    const getTypeDefinitionAtPosition = callIfDisabled(
      "getTypeDefinitionAtPosition",
      undefined,
    );
    const organizeImports = callIfDisabled("organizeImports", []);
    const prepareCallHierarchy = callIfDisabled(
      "prepareCallHierarchy",
      undefined,
    );
    const provideCallHierarchyIncomingCalls = callIfDisabled(
      "provideCallHierarchyIncomingCalls",
      [],
    );
    const provideCallHierarchyOutgoingCalls = callIfDisabled(
      "provideCallHierarchyOutgoingCalls",
      [],
    );
    const toggleLineComment = callIfDisabled("toggleLineComment", []);
    const toggleMultilineComment = callIfDisabled("toggleMultilineComment", []);
    const uncommentSelection = callIfDisabled("uncommentSelection", []);

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

  onConfigurationChanged(settings: Settings): void {
    this.log(`onConfigurationChanged(${JSON.stringify(settings)})`);
    updateSettings(this.project, settings);
    this.project.refreshDiagnostics();
  }
}

function init(): ts.server.PluginModule {
  console.log("INIT typescript-deno-plugin");
  return new Plugin();
}

export = init;

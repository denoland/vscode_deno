// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.

import type { PluginSettings, Settings } from "../../client/src/shared_types";
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
  cache: null,
  certificateStores: null,
  enable: false,
  codeLens: null,
  config: null,
  importMap: null,
  internalDebug: false,
  lint: false,
  path: null,
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
  tlsCertificate: null,
  unsafelyIgnoreCertificateErrors: null,
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

  #getGlobalSettings(): Settings {
    return projectSettings.get(this.#projectName)?.workspace ??
      defaultSettings;
  }

  #getSetting<K extends keyof Settings>(
    fileName: string,
    key: K,
  ): Settings[K] {
    const settings = projectSettings.get(this.#projectName);
    return settings?.documents?.[fileName]?.settings[key] ??
      // deno-lint-ignore no-explicit-any
      settings?.workspace?.[key] as any ?? defaultSettings[key];
  }

  #log = (_msg: string) => {};

  create(info: ts.server.PluginCreateInfo): ts.LanguageService {
    const { languageService: ls, project, config } = info;
    this.#log = (msg) =>
      project.projectService.logger.info(`[typescript-deno-plugin] ${msg}`);

    this.#project = project;
    this.#projectName = project.getProjectName();
    updateSettings(this.#project, config);
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
        const enabled = fileNameArg !== undefined
          ? this.#getSetting(args[fileNameArg] as string, "enable")
          : this.#getGlobalSettings().enable;
        return enabled
          // we should return a new array, so if someone modifies a previous on
          // we create a new one on each call
          ? Array.isArray(emptyReturn) ? [] : emptyReturn
          : target.call(ls, ...args);
      };
    };

    // This "mutes" diagnostics for things like tsconfig files.
    const projectGetGlobalProjectErrors = this.#project.getGlobalProjectErrors;
    this.#project.getGlobalProjectErrors = () =>
      this.#getGlobalSettings().enable
        ? []
        : projectGetGlobalProjectErrors.call(this.#project);
    const projectGetAllProjectErrors = this.#project.getAllProjectErrors;
    this.#project.getAllProjectErrors = () =>
      this.#getGlobalSettings().enable
        ? []
        : projectGetAllProjectErrors.call(this.#project);

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
    const getEncodedSemanticClassifications = callIfDisabled(
      "getEncodedSemanticClassifications",
      0,
      { spans: [], endOfLineState: 0 },
    );
    const getEncodedSyntacticClassifications = callIfDisabled(
      "getEncodedSyntacticClassifications",
      0,
      { spans: [], endOfLineState: 0 },
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
    const getNavigationTree = callIfDisabled("getNavigationTree", 0, {
      text: "",
      kind: "" as ts.ScriptElementKind.unknown,
      kindModifiers: "",
      spans: [],
      nameSpan: undefined,
    });
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
    const provideInlayHints = callIfDisabled("provideInlayHints", 0, []);
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
      organizeImports,
      prepareCallHierarchy,
      provideCallHierarchyIncomingCalls,
      provideCallHierarchyOutgoingCalls,
      provideInlayHints,
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

var __accessCheck = (obj, member, msg) => {
  if (!member.has(obj))
    throw TypeError("Cannot " + msg);
};
var __privateGet = (obj, member, getter) => {
  __accessCheck(obj, member, "read from private field");
  return getter ? getter.call(obj) : member.get(obj);
};
var __privateAdd = (obj, member, value) => {
  if (member.has(obj))
    throw TypeError("Cannot add the same private member more than once");
  member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
};
var __privateSet = (obj, member, value, setter) => {
  __accessCheck(obj, member, "write to private field");
  setter ? setter.call(obj, value) : member.set(obj, value);
  return value;
};
var __privateMethod = (obj, member, method) => {
  __accessCheck(obj, member, "access private method");
  return method;
};

// typescript-deno-plugin/src/index.ts
var projectSettings = /* @__PURE__ */ new Map();
var defaultSettings = {
  cache: null,
  certificateStores: null,
  enable: false,
  enablePaths: [],
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
      hosts: {}
    }
  },
  testing: null,
  tlsCertificate: null,
  unsafelyIgnoreCertificateErrors: null,
  unstable: false
};
function updateSettings(project, settings) {
  projectSettings.set(project.getProjectName(), settings);
  Object.assign(defaultSettings, settings.workspace);
}
var _project, _projectName, _denoEnabled, denoEnabled_fn, _fileNameDenoEnabled, fileNameDenoEnabled_fn, _log;
var Plugin = class {
  constructor() {
    __privateAdd(this, _denoEnabled);
    __privateAdd(this, _fileNameDenoEnabled);
    __privateAdd(this, _project, void 0);
    __privateAdd(this, _projectName, void 0);
    __privateAdd(this, _log, (_msg) => {
    });
  }
  create(info) {
    const { languageService: ls, project, config } = info;
    __privateSet(this, _log, (msg) => project.projectService.logger.info(`[typescript-deno-plugin] ${msg}`));
    __privateSet(this, _project, project);
    __privateSet(this, _projectName, project.getProjectName());
    updateSettings(__privateGet(this, _project), config);
    setImmediate(() => {
      __privateGet(this, _project).refreshDiagnostics();
    });
    const callIfDisabled = (fn, fileNameArg, emptyReturn) => {
      const target = ls[fn];
      return (...args) => {
        const enabled = fileNameArg !== void 0 ? __privateMethod(this, _fileNameDenoEnabled, fileNameDenoEnabled_fn).call(this, args[fileNameArg]) : __privateMethod(this, _denoEnabled, denoEnabled_fn);
        return enabled ? Array.isArray(emptyReturn) ? [] : typeof emptyReturn === "function" ? emptyReturn() : emptyReturn : target.call(ls, ...args);
      };
    };
    const projectGetGlobalProjectErrors = __privateGet(this, _project).getGlobalProjectErrors;
    __privateGet(this, _project).getGlobalProjectErrors = () => __privateMethod(this, _denoEnabled, denoEnabled_fn).call(this) ? [] : projectGetGlobalProjectErrors.call(__privateGet(this, _project));
    const projectGetAllProjectErrors = __privateGet(this, _project).getAllProjectErrors;
    __privateGet(this, _project).getAllProjectErrors = () => __privateMethod(this, _denoEnabled, denoEnabled_fn).call(this) ? [] : projectGetAllProjectErrors.call(__privateGet(this, _project));
    const commentSelection = callIfDisabled("commentSelection", 0, []);
    const findReferences = callIfDisabled("findReferences", 0, void 0);
    const findRenameLocations = callIfDisabled("findRenameLocations", 0, void 0);
    const getApplicableRefactors = callIfDisabled("getApplicableRefactors", 0, []);
    const getBraceMatchingAtPosition = callIfDisabled("getBraceMatchingAtPosition", 0, []);
    const getBreakpointStatementAtPosition = callIfDisabled("getBreakpointStatementAtPosition", 0, void 0);
    const getCodeFixesAtPosition = callIfDisabled("getCodeFixesAtPosition", 0, []);
    const getCompilerOptionsDiagnostics = callIfDisabled("getCompilerOptionsDiagnostics", void 0, []);
    const getCompletionEntryDetails = callIfDisabled("getCompletionEntryDetails", 0, void 0);
    const getCompletionEntrySymbol = callIfDisabled("getCompletionEntrySymbol", 0, void 0);
    const getCompletionsAtPosition = callIfDisabled("getCompletionsAtPosition", 0, void 0);
    const getDefinitionAndBoundSpan = callIfDisabled("getDefinitionAndBoundSpan", 0, void 0);
    const getDefinitionAtPosition = callIfDisabled("getDefinitionAtPosition", 0, void 0);
    const getDocCommentTemplateAtPosition = callIfDisabled("getDocCommentTemplateAtPosition", 0, void 0);
    const getDocumentHighlights = callIfDisabled("getDocumentHighlights", 0, void 0);
    const getEditsForFileRename = callIfDisabled("getEditsForFileRename", 0, []);
    const getEditsForRefactor = callIfDisabled("getEditsForRefactor", 0, void 0);
    const getEncodedSemanticClassifications = callIfDisabled("getEncodedSemanticClassifications", 0, () => ({ spans: [], endOfLineState: 0 }));
    const getEncodedSyntacticClassifications = callIfDisabled("getEncodedSyntacticClassifications", 0, () => ({ spans: [], endOfLineState: 0 }));
    const getImplementationAtPosition = callIfDisabled("getImplementationAtPosition", 0, void 0);
    const getJsxClosingTagAtPosition = callIfDisabled("getJsxClosingTagAtPosition", 0, void 0);
    const getNameOrDottedNameSpan = callIfDisabled("getNameOrDottedNameSpan", 0, void 0);
    const getNavigateToItems = callIfDisabled("getNavigateToItems", void 0, []);
    const getNavigationBarItems = callIfDisabled("getNavigationBarItems", 0, []);
    const getNavigationTree = callIfDisabled("getNavigationTree", 0, () => ({
      text: "",
      kind: "",
      kindModifiers: "",
      spans: [],
      nameSpan: void 0
    }));
    const getOutliningSpans = callIfDisabled("getOutliningSpans", 0, []);
    const getQuickInfoAtPosition = callIfDisabled("getQuickInfoAtPosition", 0, void 0);
    const getReferencesAtPosition = callIfDisabled("getReferencesAtPosition", 0, void 0);
    const getSemanticClassifications = callIfDisabled("getSemanticClassifications", 0, []);
    const getSemanticDiagnostics = callIfDisabled("getSemanticDiagnostics", 0, []);
    const getSignatureHelpItems = callIfDisabled("getSignatureHelpItems", 0, void 0);
    const getSpanOfEnclosingComment = callIfDisabled("getSpanOfEnclosingComment", 0, void 0);
    const getSuggestionDiagnostics = callIfDisabled("getSuggestionDiagnostics", 0, []);
    const getSyntacticDiagnostics = callIfDisabled("getSyntacticDiagnostics", 0, []);
    const getSyntacticClassifications = callIfDisabled("getSyntacticClassifications", 0, []);
    const getTodoComments = callIfDisabled("getTodoComments", 0, []);
    const getTypeDefinitionAtPosition = callIfDisabled("getTypeDefinitionAtPosition", 0, void 0);
    const prepareCallHierarchy = callIfDisabled("prepareCallHierarchy", 0, void 0);
    const provideCallHierarchyIncomingCalls = callIfDisabled("provideCallHierarchyIncomingCalls", 0, []);
    const provideCallHierarchyOutgoingCalls = callIfDisabled("provideCallHierarchyOutgoingCalls", 0, []);
    const provideInlayHints = callIfDisabled("provideInlayHints", 0, []);
    const toggleLineComment = callIfDisabled("toggleLineComment", 0, []);
    const toggleMultilineComment = callIfDisabled("toggleMultilineComment", 0, []);
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
      prepareCallHierarchy,
      provideCallHierarchyIncomingCalls,
      provideCallHierarchyOutgoingCalls,
      provideInlayHints,
      toggleLineComment,
      toggleMultilineComment,
      uncommentSelection
    };
  }
  onConfigurationChanged(settings) {
    __privateGet(this, _log).call(this, `onConfigurationChanged(${JSON.stringify(settings)})`);
    updateSettings(__privateGet(this, _project), settings);
    __privateGet(this, _project).refreshDiagnostics();
  }
};
_project = new WeakMap();
_projectName = new WeakMap();
_denoEnabled = new WeakSet();
denoEnabled_fn = function() {
  var _a, _b, _c;
  return (_c = (_b = (_a = projectSettings.get(__privateGet(this, _projectName))) == null ? void 0 : _a.workspace) == null ? void 0 : _b.enable) != null ? _c : defaultSettings.enable;
};
_fileNameDenoEnabled = new WeakSet();
fileNameDenoEnabled_fn = function(fileName) {
  var _a, _b, _c, _d, _e, _f;
  const settings = projectSettings.get(__privateGet(this, _projectName));
  if (settings == null ? void 0 : settings.enabledPaths) {
    const paths = (_a = settings.enabledPaths.find(({ workspace }) => fileName.startsWith(workspace))) == null ? void 0 : _a.paths;
    if (paths && paths.length) {
      return paths.some((path) => fileName.startsWith(path));
    }
  }
  return (_f = (_e = (_c = (_b = settings == null ? void 0 : settings.documents) == null ? void 0 : _b[fileName]) == null ? void 0 : _c.settings.enable) != null ? _e : (_d = settings == null ? void 0 : settings.workspace) == null ? void 0 : _d.enable) != null ? _f : defaultSettings.enable;
};
_log = new WeakMap();
function init() {
  console.log(`INIT typescript-deno-plugin`);
  return new Plugin();
}
module.exports = init;

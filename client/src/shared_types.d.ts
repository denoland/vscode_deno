// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

import type { ConfigurationScope } from "vscode";

// types shared with typescript-deno-plugin

export interface InlayHints {
  parameterNames: {
    /** Enable/disable inlay hints for parameter names. */
    enabled: "none" | "literals" | "all";
    /** Do not display an inlay hint when the argument name matches the parameter. */
    suppressWhenArgumentMatchesName: boolean;
  } | null;
  /** Enable/disable inlay hints for implicit parameter types. */
  parameterTypes: { enabled: boolean } | null;
  variableTypes: {
    /** Enable/disable inlay hints for implicit variable types. */
    enabled: boolean;
    /** Suppress type hints where the variable name matches the implicit type. */
    suppressWhenTypeMatchesName: boolean;
  } | null;
  /** Enable/disable inlay hints for implicit property declarations. */
  propertyDeclarationTypes: { enabled: boolean } | null;
  /** Enable/disable inlay hints for implicit function return types. */
  functionLikeReturnTypes: { enabled: boolean } | null;
  /** Enable/disable inlay hints for enum values. */
  enumMemberValues: { enabled: boolean } | null;
}

export interface Suggest {
  autoImports: boolean;
  completeFunctionCalls: boolean;
  names: boolean;
  paths: boolean;
}

// Subset of the "javascript" and "typescript" config sections.
export interface LanguageSettings {
  inlayHints: InlayHints | null;
  preferences: {
    quoteStyle: "auto" | "double" | "single";
    importModuleSpecifier:
      | "non-relative"
      | "project-relative"
      | "relative"
      | "shortest";
    importModuleSpecifierEnding: "auto" | "index" | "js" | "minimal";
    jsxAttributeCompletionStyle: "auto" | "braces" | "none";
    autoImportFileExcludePatterns: string[];
    useAliasesForRenames: boolean;
    renameMatchingJsxTags: boolean;
  } | null;
  suggest: Suggest | null;
  updateImportsOnFileMove: {
    enabled: "always" | "prompt" | "never";
  } | null;
}

/** When `vscode.WorkspaceSettings` get serialized, they keys of the
 * configuration are available.  This interface should mirror the configuration
 * contributions made by the extension.
 *
 * **WARNING** please ensure that the `workspaceSettingsKeys` contains all the
 * top level keys of this, as they need to be sent to the server on
 * initialization.
 */
export interface Settings {
  /** Specify an explicit path to the `deno` cache instead of using DENO_DIR
   * or the OS default. */
  cache: string | null;
  certificateStores: string[] | null;
  /** Settings related to code lens. */
  codeLens: {
    implementations: boolean;
    references: boolean;
    referencesAllFunctions: boolean;
    test: boolean;
    testArgs: string[];
  } | null;
  /** A path to a configuration file that should be applied. */
  config: string | null;
  /** Maximum number of file system entries to traverse when preloading. */
  documentPreloadLimit: number | null;
  maxTsServerMemory: number | null;
  /** Is the extension enabled or not. */
  enable: boolean | null;
  /** Controls if the extension should cache the active document's dependencies on save. */
  cacheOnSave: boolean;
  /** Paths in the workspace that should be Deno enabled. */
  disablePaths: string[];
  /** If set, indicates that only the paths in the workspace should be Deno
   * enabled. */
  enablePaths: string[];
  /** A path to an import map that should be applied. */
  importMap: string | null;
  /** Options related to the display of inlay hints. */
  // TODO(nayeemrmn): Deprecate in favour of `LanguageSettings::inlayHints`.
  inlayHints: InlayHints | null;
  /** A flag that enables additional internal debug information to be printed
   * to the _Deno Language Server_ output. */
  internalDebug: boolean;
  /** Determine if the extension should be providing linting diagnostics. */
  lint: boolean;
  /** Specify an explicit path to the `deno` binary. */
  path: string | null;
  // TODO(nayeemrmn): Deprecate the `Suggest` part of this in favour of
  // `LanguageSettings::suggest`.
  suggest:
    | Suggest & {
      imports: {
        autoDiscover: boolean;
        hosts: Record<string, boolean>;
      } | null;
    }
    | null;
  testing: { args: string[] } | null;
  tlsCertificate: string | null;
  unsafelyIgnoreCertificateErrors: string[] | null;
  /** Determine if the extension should be type checking against the unstable
   * APIs. */
  unstable: boolean;
  javascript?: LanguageSettings | null;
  typescript?: LanguageSettings | null;
}

export interface PathFilter {
  /** The file system path of the workspace folder that is partially enabled. */
  workspace: string;
  /** The file system paths that are Deno disabled. */
  disabled: string[];
  /** The file system paths that are Deno enabled. */
  enabled: string[] | null;
}

export interface PluginSettings {
  documents: Record<string, DocumentSettings>;
  pathFilters: PathFilter[];
  /** Whether or not there is a `deno.json{c,}` at the workspace root. */
  hasDenoConfig: boolean;
  workspace: Settings;
}

export interface DocumentSettings {
  scope: ConfigurationScope;
  settings: Partial<Settings>;
}

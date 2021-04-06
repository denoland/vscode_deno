// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.

import type { StatusBarItem } from "vscode";
import type {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
} from "vscode-languageclient/node";

/** When `vscode.WorkspaceSettings` get serialized, they keys of the
 * configuration are available.  This interface should mirror the configuration
 * contributions made by the extension.
 */
export interface Settings {
  /** Is the extension enabled or not. */
  enable: boolean;
  /** Settings related to code lens. */
  codeLens: {
    implementations: boolean;
    references: boolean;
    referencesAllFunctions: boolean;
  } | null;
  /** A path to a `tsconfig.json` that should be applied. */
  config: string | null;
  /** A path to an import map that should be applied. */
  importMap: string | null;
  /** Determine if the extension should be providing linting diagnostics. */
  lint: boolean;
  /** Determine if the extension should be type checking against the unstable
	 * APIs. */
  unstable: boolean;
}

export interface DenoExtensionContext {
  client: LanguageClient;
  clientOptions: LanguageClientOptions;
  serverOptions: ServerOptions;
  serverVersion: string;
  statusBarItem: StatusBarItem;
  tsApi: TsLanguageFeaturesApiV0;
}

export interface TsLanguageFeaturesApiV0 {
  configurePlugin(
    pluginId: string,
    configuration: Settings,
  ): void;
}

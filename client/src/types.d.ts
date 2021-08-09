// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.

import type {
  LanguageClient,
  LanguageClientOptions,
} from "vscode-languageclient/node";
import type { DenoServerInfo } from "./server_info";
import type { DocumentSettings, Settings } from "./shared_types";
import type { DenoStatusBar } from "./status_bar";

export * from "./shared_types";

export interface TsApi {
  /** Update the typescript-deno-plugin with settings. */
  refresh(): void;
}

export interface DenoExtensionContext {
  client: LanguageClient | undefined;
  clientOptions: LanguageClientOptions;
  /** A record of filepaths and their document settings. */
  documentSettings: Record<string, DocumentSettings>;
  serverInfo: DenoServerInfo | undefined;
  statusBar: DenoStatusBar;
  tsApi: TsApi;
  /** The current workspace settings. */
  workspaceSettings: Settings;
}

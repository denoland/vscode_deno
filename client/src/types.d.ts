// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

import type {
  LanguageClient,
  LanguageClientOptions,
} from "vscode-languageclient/node";
import type { DenoServerInfo } from "./server_info";
import type { DocumentSettings, PathFilter, Settings } from "./shared_types";
import type { DenoStatusBar } from "./status_bar";
import type * as vscode from "vscode";

import type { ServerCapabilities } from "vscode-languageclient";

export * from "./shared_types";

export interface TsApi {
  /** Update the typescript-deno-plugin with settings. */
  refresh(): void;
}

interface DenoExperimental {
  /** Support for the `deno/task` request, which returns any tasks that are
   * defined in configuration files. */
  denoConfigTasks?: boolean;
}

export interface DenoExtensionContext {
  client: LanguageClient | undefined;
  clientOptions: LanguageClientOptions;
  /** A record of filepaths and their document settings. */
  documentSettings: Record<string, DocumentSettings>;
  pathFilters: PathFilter[];
  serverInfo: DenoServerInfo | undefined;
  /** The capabilities returned from the server. */
  serverCapabilities:
    | ServerCapabilities<DenoExperimental>
    | undefined;
  statusBar: DenoStatusBar;
  testController: vscode.TestController | undefined;
  tsApi: TsApi;
  hasDenoConfig: boolean;
  /** The current workspace settings. */
  workspaceSettings: Settings;
  outputChannel: vscode.OutputChannel;
}

export interface TestCommandOptions {
  inspect: boolean;
}

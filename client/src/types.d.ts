// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

import type {
  LanguageClient,
  LanguageClientOptions,
} from "vscode-languageclient/node";
import type { DenoServerInfo } from "./server_info";
import type { EnableSettings } from "./shared_types";
import type { DenoStatusBar } from "./status_bar";
import type * as vscode from "vscode";

import type { ServerCapabilities } from "vscode-languageclient";
import { DenoTasksTreeDataProvider } from "./tasks_sidebar";

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
  clientSubscriptions: { dispose(): unknown }[] | undefined;
  clientOptions: LanguageClientOptions;
  serverInfo: DenoServerInfo | undefined;
  /** The capabilities returned from the server. */
  serverCapabilities:
    | ServerCapabilities<DenoExperimental>
    | undefined;
  scopesWithDenoJson: Set<string> | undefined;
  statusBar: DenoStatusBar;
  tsApi: TsApi;
  outputChannel: vscode.OutputChannel;
  tasksSidebar: DenoTasksTreeDataProvider;
  maxTsServerMemory: number | null;
  enableSettingsUnscoped: EnableSettings;
  enableSettingsByFolder: [string, EnableSettings][];
}

export interface TestCommandOptions {
  inspect: boolean;
}

export interface UpgradeAvailable {
  latestVersion: string;
  isCanary: boolean;
}

export interface DidUpgradeCheckParams {
  upgradeAvailable: UpgradeAvailable | null;
}

export interface DenoConfigurationChangeEvent {
  scopeUri: string;
  fileUri: string;
  type: "added" | "changed" | "removed";
  configurationType: "denoJson" | "packageJson";
}

export interface DidChangeDenoConfigurationParams {
  changes: DenoConfigurationChangeEvent[];
}

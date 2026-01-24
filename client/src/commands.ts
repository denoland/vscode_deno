// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

/** Contains handlers for commands that are enabled in Visual Studio Code for
 * the extension. */

import {
  ENABLEMENT_FLAG,
  EXTENSION_NS,
  LANGUAGE_CLIENT_ID,
  LANGUAGE_CLIENT_NAME,
  SERVER_SEMVER,
} from "./constants";
import * as tasks from "./tasks";
import { DenoTestController, TestingFeature } from "./testing";
import type {
  DenoExtensionContext,
  DidChangeDenoConfigurationParams,
  DidUpgradeCheckParams,
  TestCommandOptions,
} from "./types";
import { WelcomePanel } from "./welcome";
import {
  assert,
  getDenoCommandName,
  getDenoCommandPath,
  getInspectArg,
} from "./util";
import { registryState } from "./lsp_extensions";
import { createRegistryStateHandler } from "./notification_handlers";
import { DenoServerInfo } from "./server_info";

import * as dotenv from "dotenv";
import * as vscode from "vscode";
import { ServerOptions } from "vscode-languageclient/node";
import type {
  Executable,
  Location,
  Position,
} from "vscode-languageclient/node";
import { getWorkspacesEnabledInfo } from "./enable";
import { denoUpgradePromptAndExecute } from "./upgrade";
import * as fs from "fs";
import * as path from "path";
import * as process from "process";
import { semver } from "./semver";
import { DenoLanguageClient } from "./deno_language_client";

// deno-lint-ignore no-explicit-any
export type Callback = (...args: any[]) => unknown;
export type Factory = (
  context: vscode.ExtensionContext,
  extensionContext: DenoExtensionContext,
) => Callback;

export function cacheActiveDocument(
  _context: vscode.ExtensionContext,
  _extensionContext: DenoExtensionContext,
): Callback {
  return () => {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      return;
    }
    const uri = activeEditor.document.uri.toString();
    return vscode.window.withProgress({
      location: vscode.ProgressLocation.Window,
      title: "caching",
    }, () => {
      return vscode.commands.executeCommand("deno.cache", [uri], uri);
    });
  };
}

export function clearHiddenPromptStorage(
  _context: vscode.ExtensionContext,
  _extensionContext: DenoExtensionContext,
): Callback {
  return () => {
    // Reset states for 'Don't show this again' prompt responses, etc.
    // Currently unused.
  };
}

export function info(
  context: vscode.ExtensionContext,
  extensionContext: DenoExtensionContext,
): Callback {
  return async () => {
    await vscode.window.showInformationMessage(
      `deno ${extensionContext.serverInfo?.versionWithBuildInfo} | vscode_deno ${context.extension.packageJSON?.version} | vscode ${vscode.version}`,
    );
  };
}

/** Start (or restart) the Deno Language Server */
export function startLanguageServer(
  context: vscode.ExtensionContext,
  extensionContext: DenoExtensionContext,
): Callback {
  return async () => {
    // Stop the existing language server and reset the state
    if (extensionContext.client) {
      const client = extensionContext.client;
      extensionContext.client = undefined;
      for (const disposable of extensionContext.clientSubscriptions ?? []) {
        disposable.dispose();
      }
      extensionContext.statusBar.refresh(extensionContext);
      vscode.commands.executeCommand("setContext", ENABLEMENT_FLAG, false);
      const timeoutMs = 10_000;
      await client.stop(timeoutMs);
    }
    extensionContext.clientSubscriptions = [];

    if (isDenoDisabledCompletely()) {
      extensionContext.outputChannel.appendLine(
        'Warning: The Deno language server is explicitly disabled for every directory. If this is not intentional, check your user and workspace settings for entries like `"deno.enable": false` and `"deno.enablePaths": []`.',
      );
      return;
    }

    // Start a new language server
    const command = await getDenoCommandPath(extensionContext.approvedPaths);
    if (command == null) {
      const message =
        "Could not resolve Deno executable. Please ensure it is available " +
        `on the PATH used by VS Code or set an explicit "deno.path" setting.`;

      // only show the message if the user has enabled deno or they have
      // a deno configuration file and haven't explicitly disabled deno
      const enabledInfo = await getWorkspacesEnabledInfo();
      const shouldShowMessage = enabledInfo
        .some((e) => e.enabled || e.hasDenoConfig && e.enabled !== false);
      if (shouldShowMessage) {
        vscode.window.showErrorMessage(message);
      }
      extensionContext.outputChannel.appendLine(`Error: ${message}`);
      return;
    }

    const config = vscode.workspace.getConfiguration(EXTENSION_NS);

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const env: Record<string, string | undefined> = {
      ...process.env,
    };
    const denoEnvFile = config.get<string>("envFile");
    if (denoEnvFile) {
      if (workspaceFolder) {
        const denoEnvPath = path.join(workspaceFolder.uri.fsPath, denoEnvFile);
        try {
          const content = fs.readFileSync(denoEnvPath, { encoding: "utf8" });
          const parsed = dotenv.parse(content);
          Object.assign(env, parsed);
        } catch (error) {
          vscode.window.showErrorMessage(
            `Could not read env file "${denoEnvPath}": ${error}`,
          );
        }
      }
    }
    const denoEnv = config.get<Record<string, string>>("env");
    env["FORCE_COLOR"] = "1";
    if (denoEnv) {
      Object.assign(env, denoEnv);
    }
    if (config.get<boolean>("future")) {
      env["DENO_FUTURE"] = "1";
    }
    env["DENO_V8_FLAGS"] = getV8Flags();

    const shell = process.platform === "win32" &&
      /\.([Cc][Mm][Dd]|[Bb][Aa][Tt])$/.test(command);
    const serverOptions: ServerOptions = {
      run: {
        command,
        args: ["lsp"],
        options: { env, shell },
      } as Executable,
      debug: {
        command,
        // disabled for now, as this gets super chatty during development
        // args: ["lsp", "-L", "debug"],
        args: ["lsp"],
        options: { env, shell },
      } as Executable,
    };
    const client = new DenoLanguageClient(
      LANGUAGE_CLIENT_ID,
      LANGUAGE_CLIENT_NAME,
      serverOptions,
      {
        outputChannel: extensionContext.outputChannel,
        middleware: {
          workspace: {
            configuration: (params, token, next) => {
              const response = next(params, token) as Record<string, unknown>[];
              for (let i = 0; i < response.length; i++) {
                const item = params.items[i];
                if (item.section == "deno") {
                  transformDenoConfiguration(extensionContext, response[i]);
                }
              }
              return response;
            },
          },
        },
        ...extensionContext.clientOptions,
      },
    );
    const testingFeature = new TestingFeature();
    client.registerFeature(testingFeature);
    client.registerFeature({
      fillClientCapabilities(capabilities) {
        capabilities.experimental ??= {};
        const experimental: { clientProvidedOrganizeImports?: boolean } =
          capabilities.experimental ??
            {};
        experimental.clientProvidedOrganizeImports = true;
        capabilities.experimental = experimental;
      },
      getState() {
        return { kind: "static" };
      },
      initialize() {},
      clear() {},
    });
    await client.start();

    // set this after a successful start
    extensionContext.client = client;

    vscode.commands.executeCommand("setContext", ENABLEMENT_FLAG, true);
    extensionContext.serverInfo = new DenoServerInfo(
      client.initializeResult?.serverInfo,
    );
    extensionContext.serverCapabilities = client.initializeResult?.capabilities;
    extensionContext.statusBar.refresh(extensionContext);

    extensionContext.clientSubscriptions.push(
      extensionContext.client.onNotification(
        "deno/didUpgradeCheck",
        (params: DidUpgradeCheckParams) => {
          if (extensionContext.serverInfo) {
            extensionContext.serverInfo.upgradeAvailable =
              params.upgradeAvailable;
            extensionContext.statusBar.refresh(extensionContext);
          }
        },
      ),
    );

    if (testingFeature.enabled) {
      extensionContext.clientSubscriptions.push(
        new DenoTestController(extensionContext.client),
      );
    }

    extensionContext.clientSubscriptions.push(
      client.onNotification(
        registryState,
        createRegistryStateHandler(),
      ),
    );

    const scopesWithDenoJson = new Set<string>();
    extensionContext.scopesWithDenoJson = scopesWithDenoJson;
    extensionContext.clientSubscriptions.push(
      extensionContext.client.onNotification(
        "deno/didChangeDenoConfiguration",
        ({ changes }: DidChangeDenoConfigurationParams) => {
          let changedScopes = false;
          for (const change of changes) {
            if (change.configurationType != "denoJson") {
              continue;
            }
            if (change.type == "added") {
              const scopePath = vscode.Uri.parse(change.scopeUri).fsPath;
              scopesWithDenoJson.add(scopePath);
              changedScopes = true;
            } else if (change.type == "removed") {
              const scopePath = vscode.Uri.parse(change.scopeUri).fsPath;
              scopesWithDenoJson.delete(scopePath);
              changedScopes = true;
            }
          }
          if (changedScopes) {
            extensionContext.tsApi?.refresh();
          }
          extensionContext.tasksSidebar.refresh();
        },
      ),
    );

    extensionContext.tsApi.refresh();

    if (
      semver.valid(extensionContext.serverInfo.version) &&
      !semver.satisfies(extensionContext.serverInfo.version, SERVER_SEMVER)
    ) {
      notifyServerSemver(extensionContext.serverInfo.version);
    } else {
      showWelcomePageIfFirstUse(context, extensionContext);
    }
  };

  function getV8Flags() {
    let v8Flags = process.env.DENO_V8_FLAGS ?? "";
    const hasMaxOldSpaceSizeFlag = v8Flags.includes("--max-old-space-size=") ||
      v8Flags.includes("--max_old_space_size=");
    if (
      hasMaxOldSpaceSizeFlag &&
      extensionContext.maxTsServerMemory == null
    ) {
      // the v8 flags already include a max-old-space-size and the user
      // has not provided a maxTsServerMemory value
      return v8Flags;
    }
    // Use the same defaults and minimum as vscode uses for this setting
    // https://github.com/microsoft/vscode/blob/48d4ba271686e8072fc6674137415bc80d936bc7/extensions/typescript-language-features/src/configuration/configuration.ts#L213-L214
    const maxTsServerMemory = Math.max(
      128,
      extensionContext.maxTsServerMemory ?? 3072,
    );
    if (v8Flags.length > 0) {
      v8Flags += ",";
    }
    // flags at the end take precedence
    v8Flags += `--max-old-space-size=${maxTsServerMemory}`;
    return v8Flags;
  }
}

function notifyServerSemver(serverVersion: string) {
  return vscode.window.showWarningMessage(
    `The version of Deno language server ("${serverVersion}") does not meet the requirements of the extension ("${SERVER_SEMVER}"). Please update Deno and restart.`,
    "OK",
  );
}

/** Mutates the `config` parameter. For compatibility currently. */
export function transformDenoConfiguration(
  extensionContext: DenoExtensionContext,
  config: Record<string, unknown>,
) {
  // TODO(nayeemrmn): Deno > 2.0.0-rc.1 expects `deno.unstable` as
  // an array of features. Remove this eventually.
  if (
    semver.lte(extensionContext.serverInfo?.version || "1.0.0", "2.0.0-rc.1")
  ) {
    config.unstable = !!config.unstable;
  }
}

function showWelcomePageIfFirstUse(
  context: vscode.ExtensionContext,
  extensionContext: DenoExtensionContext,
) {
  if (process.env.DENO_DISABLE_WELCOME_PAGE != null) {
    return;
  }
  const welcomeShown = context.globalState.get<boolean>("deno.welcomeShown") ??
    false;
  if (welcomeShown) {
    return;
  }
  welcome(context, extensionContext)();
  context.globalState.update("deno.welcomeShown", true);
}

export function showReferences(
  _content: vscode.ExtensionContext,
  extensionContext: DenoExtensionContext,
): Callback {
  return (uri: string, position: Position, locations: Location[]) => {
    if (!extensionContext.client) {
      return;
    }
    vscode.commands.executeCommand(
      "editor.action.showReferences",
      vscode.Uri.parse(uri),
      extensionContext.client.protocol2CodeConverter.asPosition(position),
      locations.map(extensionContext.client.protocol2CodeConverter.asLocation),
    );
  };
}

let statusRequestIndex = 0;

/** Open and display the "virtual document" which provides the status of the
 * Deno Language Server. */
export function status(
  _context: vscode.ExtensionContext,
  _extensionContext: DenoExtensionContext,
): Callback {
  return () => {
    const uri = vscode.Uri.parse(`deno:/status.md?${statusRequestIndex++}`);
    return vscode.commands.executeCommand("markdown.showPreviewToSide", uri);
  };
}

export function test(
  _context: vscode.ExtensionContext,
  extensionContext: DenoExtensionContext,
): Callback {
  return async (uriStr: string, name: string, options: TestCommandOptions) => {
    const uri = vscode.Uri.parse(uriStr, true);
    const filePath = uri.fsPath;
    const config = vscode.workspace.getConfiguration(EXTENSION_NS, uri);
    const testArgs: string[] = [
      ...(config.get<string[]>("codeLens.testArgs") ?? []),
    ];
    const unstable = config.get("unstable") as string[] ?? [];
    for (const unstableFeature of unstable) {
      const flag = `--unstable-${unstableFeature}`;
      if (!testArgs.includes(flag)) {
        testArgs.push(flag);
      }
    }
    if (options?.inspect) {
      testArgs.push(getInspectArg(extensionContext.serverInfo?.version));
    }
    if (!testArgs.includes("--import-map")) {
      const importMap: string | undefined | null = config.get("importMap");
      if (importMap?.trim()) {
        testArgs.push("--import-map", importMap.trim());
      }
    }
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const env = {} as Record<string, string>;
    const denoEnvFile = config.get<string>("envFile");
    if (denoEnvFile) {
      if (workspaceFolder) {
        const denoEnvPath = path.join(workspaceFolder.uri.fsPath, denoEnvFile);
        try {
          const content = fs.readFileSync(denoEnvPath, { encoding: "utf8" });
          const parsed = dotenv.parse(content);
          Object.assign(env, parsed);
        } catch (error) {
          vscode.window.showErrorMessage(
            `Could not read env file "${denoEnvPath}": ${error}`,
          );
        }
      }
    }
    const denoEnv = config.get<Record<string, string>>("env");
    if (denoEnv) {
      Object.assign(env, denoEnv);
    }
    const cacheDir: string | undefined | null = config.get("cache");
    if (cacheDir?.trim()) {
      env["DENO_DIR"] = cacheDir.trim();
    }
    if (config.get<boolean>("future")) {
      env["DENO_FUTURE"] = "1";
    }
    const nameRegex = `/^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$/`;
    const args = ["test", ...testArgs, "--filter", nameRegex, filePath];

    const definition: tasks.DenoTaskDefinition = {
      type: tasks.TASK_TYPE,
      command: "test",
      args,
      env,
    };

    assert(workspaceFolder);
    const denoCommand = await getDenoCommandName(
      extensionContext.approvedPaths,
    );
    const task = tasks.buildDenoTask(
      workspaceFolder,
      denoCommand,
      definition,
      `test "${name}"`,
      args,
      ["$deno-test"],
    );

    task.presentationOptions = {
      reveal: vscode.TaskRevealKind.Always,
      panel: vscode.TaskPanelKind.Dedicated,
      clear: true,
    };
    task.group = vscode.TaskGroup.Test;

    const createdTask = await vscode.tasks.executeTask(task);

    if (options?.inspect) {
      await vscode.debug.startDebugging(workspaceFolder, {
        name,
        request: "attach",
        type: "node",
      });
    }

    return createdTask;
  };
}

export function welcome(
  context: vscode.ExtensionContext,
  _extensionContext: DenoExtensionContext,
): Callback {
  return () => {
    WelcomePanel.createOrShow(context.extensionUri);
  };
}

export function statusBarClicked(
  _context: vscode.ExtensionContext,
  extensionContext: DenoExtensionContext,
) {
  return () => {
    extensionContext.outputChannel.show(true);
    if (extensionContext.serverInfo?.upgradeAvailable) {
      // Async dispatch on purpose.
      denoUpgradePromptAndExecute(
        extensionContext.serverInfo.upgradeAvailable,
        extensionContext.approvedPaths,
      );
    }
  };
}

export function enable(
  _context: vscode.ExtensionContext,
  _extensionContext: DenoExtensionContext,
) {
  return async () => {
    const config = vscode.workspace.getConfiguration(EXTENSION_NS);
    await config.update("enable", true);
    vscode.window.showInformationMessage("Deno workspace initialized.");
    const tsserverConfig = vscode.workspace.getConfiguration(
      "typescript.tsserver",
    );
    if (tsserverConfig.get<boolean>("experimental.enableProjectDiagnostics")) {
      try {
        await tsserverConfig.update(
          "experimental.enableProjectDiagnostics",
          false,
          vscode.ConfigurationTarget.Workspace,
        );
        vscode.window.showInformationMessage(
          'Disabled "typescript.tsserver.experimental.enableProjectDiagnostics" for the workspace. The Deno extension is incompatible with this setting. See: https://github.com/denoland/vscode_deno/issues/437#issuecomment-1720393193.',
        );
      } catch {
        vscode.window.showWarningMessage(
          'Setting "typescript.tsserver.experimental.enableProjectDiagnostics" is incompatible with the Deno extension. Either disable it in your user settings, or create a workspace and run the "Deno: Enable" command again. See: https://github.com/denoland/vscode_deno/issues/437#issuecomment-1720393193.',
        );
      }
    }
  };
}

export function disable(
  _context: vscode.ExtensionContext,
  _extensionContext: DenoExtensionContext,
) {
  return async () => {
    const config = vscode.workspace.getConfiguration(EXTENSION_NS);
    await config.update("enable", false);
  };
}

function isDenoDisabledCompletely(): boolean {
  function isScopeDisabled(config: vscode.WorkspaceConfiguration): boolean {
    const enable = config.get<boolean | null>("enable") ?? null;
    const enablePaths = config.get<string[] | null>("enablePaths") ?? null;
    if (enablePaths && enablePaths.length == 0) {
      return true;
    }
    return enable === false && enablePaths == null;
  }
  const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
  if (workspaceFolders.length == 0) {
    return isScopeDisabled(vscode.workspace.getConfiguration(EXTENSION_NS));
  }
  return workspaceFolders.map((f) =>
    vscode.workspace.getConfiguration(EXTENSION_NS, f)
  ).every(isScopeDisabled);
}

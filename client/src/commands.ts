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
import { LanguageClient, ServerOptions } from "vscode-languageclient/node";
import type { Location, Position } from "vscode-languageclient/node";
import { getWorkspacesEnabledInfo, isPathEnabled } from "./enable";
import { denoUpgradePromptAndExecute } from "./upgrade";
import * as fs from "fs";
import * as path from "path";
import * as process from "process";
import * as jsoncParser from "jsonc-parser/lib/esm/main.js";
import { semver } from "./semver";
import { log } from "./extension";

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
  context: vscode.ExtensionContext,
  _extensionContext: DenoExtensionContext,
): Callback {
  return () => {
    context.globalState.update("deno.tsConfigPathsWithPromptHidden", []);
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
    const command = await getDenoCommandPath();
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
    if (denoEnv) {
      Object.assign(env, denoEnv);
    }
    if (config.get<boolean>("future")) {
      env["DENO_FUTURE"] = "1";
    }
    env["NO_COLOR"] = "1";
    env["DENO_V8_FLAGS"] = getV8Flags();

    const serverOptions: ServerOptions = {
      run: {
        command,
        args: ["lsp"],
        options: { env },
      },
      debug: {
        command,
        // disabled for now, as this gets super chatty during development
        // args: ["lsp", "-L", "debug"],
        args: ["lsp"],
        options: { env },
      },
    };
    const client = new LanguageClient(
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
        async ({ changes }: DidChangeDenoConfigurationParams) => {
          let changedScopes = false;
          const addedDenoJsonUris = [];
          for (const change of changes) {
            if (change.configurationType != "denoJson") {
              continue;
            }
            if (change.type == "added") {
              const scopePath = vscode.Uri.parse(change.scopeUri).fsPath;
              scopesWithDenoJson.add(scopePath);
              changedScopes = true;
              addedDenoJsonUris.push(vscode.Uri.parse(change.fileUri));
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
          for (const addedDenoJsonUri of addedDenoJsonUris) {
            await maybeShowTsConfigPrompt(
              context,
              extensionContext,
              addedDenoJsonUri,
            );
          }
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
  const welcomeShown = context.globalState.get<boolean>("deno.welcomeShown") ??
    false;

  if (!welcomeShown) {
    welcome(context, extensionContext)();
    context.globalState.update("deno.welcomeShown", true);
  }
}

function isObject(value: unknown) {
  return value && typeof value == "object" && !Array.isArray(value);
}

/**
 * For a discovered deno.json file, see if there's an adjacent tsconfig.json.
 * Offer options to either copy over the compiler options from it, or disable
 * the Deno LSP if it contains plugins.
 */
async function maybeShowTsConfigPrompt(
  context: vscode.ExtensionContext,
  extensionContext: DenoExtensionContext,
  denoJsonUri: vscode.Uri,
) {
  const denoJsonPath = denoJsonUri.fsPath;
  if (!isPathEnabled(extensionContext, denoJsonPath)) {
    return;
  }
  const scopePath = path.dirname(denoJsonPath) + path.sep;
  const tsConfigPath = path.join(scopePath, "tsconfig.json");
  const tsConfigPathsWithPromptHidden = context.globalState.get<string[]>(
    "deno.tsConfigPathsWithPromptHidden",
  ) ?? [];
  if (tsConfigPathsWithPromptHidden?.includes?.(tsConfigPath)) {
    return;
  }
  let tsConfigContent;
  try {
    const tsConfigText = await fs.promises.readFile(tsConfigPath, {
      encoding: "utf8",
    });
    tsConfigContent = jsoncParser.parse(tsConfigText);
  } catch {
    return;
  }
  const compilerOptions = tsConfigContent?.compilerOptions;
  if (!isObject(compilerOptions)) {
    return;
  }
  for (const key in compilerOptions) {
    if (!ALLOWED_COMPILER_OPTIONS.includes(key)) {
      delete compilerOptions[key];
    }
  }
  if (Object.entries(compilerOptions).length == 0) {
    return;
  }
  const plugins = compilerOptions?.plugins;
  let selection;
  if (Array.isArray(plugins) && plugins.length) {
    // This tsconfig.json contains plugins. Prompt to disable the LSP.
    const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
    let scopeFolderEntry = null;
    const folderEntries = workspaceFolders.map((f) =>
      [f.uri.fsPath + path.sep, f] as const
    );
    folderEntries.sort();
    folderEntries.reverse();
    for (const folderEntry of folderEntries) {
      if (scopePath.startsWith(folderEntry[0])) {
        scopeFolderEntry = folderEntry;
        break;
      }
    }
    if (!scopeFolderEntry) {
      return;
    }
    const [scopeFolderPath, scopeFolder] = scopeFolderEntry;
    selection = await vscode.window.showInformationMessage(
      `A tsconfig.json with compiler options was discovered in a Deno-enabled folder. For projects with compiler plugins, it is recommended to disable the Deno language server if you are seeing errors (${tsConfigPath}).`,
      "Disable Deno LSP",
      "Hide this message",
    );
    if (selection == "Disable Deno LSP") {
      const config = vscode.workspace.getConfiguration(
        EXTENSION_NS,
        scopeFolder,
      );
      if (scopePath == scopeFolderPath) {
        await config.update("enable", false);
      } else {
        let disablePaths = config.get<string[]>("disablePaths");
        if (!Array.isArray(disablePaths)) {
          disablePaths = [];
        }
        const relativeUri = scopePath.substring(scopeFolderPath.length).replace(
          /\\/g,
          "/",
        ).replace(/\/*$/, "");
        disablePaths.push(relativeUri);
        await config.update("disablePaths", disablePaths);
      }
    }
  } else {
    // This tsconfig.json has compiler options which may be copied to a
    // deno.json. If the deno.json has no compiler options, prompt to copy them
    // over.
    let denoJsonText;
    let denoJsonContent;
    try {
      denoJsonText = await fs.promises.readFile(denoJsonPath, {
        encoding: "utf8",
      });
      denoJsonContent = jsoncParser.parse(denoJsonText);
    } catch {
      return;
    }
    if (!isObject(denoJsonContent) || "compilerOptions" in denoJsonContent) {
      return;
    }
    selection = await vscode.window.showInformationMessage(
      `A tsconfig.json with compiler options was discovered in a Deno-enabled folder. Would you like to copy these to your Deno configuration file? Note that only a subset of options are supported (${tsConfigPath}).`,
      "Copy to deno.json[c]",
      "Hide this message",
    );
    if (selection == "Copy to deno.json[c]") {
      try {
        let newDenoJsonContent = jsoncParser.applyEdits(
          denoJsonText,
          jsoncParser.modify(
            denoJsonText,
            ["compilerOptions"],
            compilerOptions,
            { formattingOptions: { insertSpaces: true, tabSize: 2 } },
          ),
        );
        const unstable = Array.isArray(denoJsonContent.unstable)
          ? denoJsonContent.unstable as unknown[]
          : [];
        if (!unstable.includes("sloppy-imports")) {
          unstable.push("sloppy-imports");
          newDenoJsonContent = jsoncParser.applyEdits(
            newDenoJsonContent,
            jsoncParser.modify(
              newDenoJsonContent,
              ["unstable"],
              unstable,
              { formattingOptions: { insertSpaces: true, tabSize: 2 } },
            ),
          );
        }
        await fs.promises.writeFile(denoJsonPath, newDenoJsonContent);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Could not modify "${denoJsonPath}": ${error}`,
        );
      }
    }
  }
  if (selection == "Hide this message") {
    const tsConfigPathsWithPromptHidden = context.globalState.get<string[]>(
      "deno.tsConfigPathsWithPromptHidden",
    ) ?? [];
    tsConfigPathsWithPromptHidden?.push?.(tsConfigPath);
    context.globalState.update(
      "deno.tsConfigPathsWithPromptHidden",
      tsConfigPathsWithPromptHidden,
    );
  }
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
    const denoCommand = await getDenoCommandName();
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
      denoUpgradePromptAndExecute(extensionContext.serverInfo.upgradeAvailable);
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

// Keep this in sync with the supported compiler options set in CLI. Currently:
// https://github.com/denoland/deno_config/blob/0.47.1/src/deno_json/ts.rs#L85-L119
const ALLOWED_COMPILER_OPTIONS = [
  "allowUnreachableCode",
  "allowUnusedLabels",
  "checkJs",
  "emitDecoratorMetadata",
  "exactOptionalPropertyTypes",
  "experimentalDecorators",
  "isolatedDeclarations",
  "jsx",
  "jsxFactory",
  "jsxFragmentFactory",
  "jsxImportSource",
  "jsxPrecompileSkipElements",
  "lib",
  "noErrorTruncation",
  "noFallthroughCasesInSwitch",
  "noImplicitAny",
  "noImplicitOverride",
  "noImplicitReturns",
  "noImplicitThis",
  "noPropertyAccessFromIndexSignature",
  "noUncheckedIndexedAccess",
  "noUnusedLocals",
  "noUnusedParameters",
  "rootDirs",
  "strict",
  "strictBindCallApply",
  "strictBuiltinIteratorReturn",
  "strictFunctionTypes",
  "strictNullChecks",
  "strictPropertyInitialization",
  "types",
  "useUnknownInCatchVariables",
  "verbatimModuleSyntax",
];

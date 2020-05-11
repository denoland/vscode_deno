// Copyright 2019-2020 the Deno authors. All rights reserved. MIT license.

import * as vscode from "vscode";
import * as nls from "vscode-nls";
import * as lsp from "vscode-languageclient";

import { registerCommands } from "./commands";
import { projectLoadingNotification } from "./protocol";

import { outputChannel } from "./output";

import {
  isTypeScriptDocument,
  isJavaScriptDocument,
  getVersions,
  generateDtsForDeno,
  getTypeScriptLanguageExtension,
  getServerOptions,
  restartTsServer,
  packageJsonExists,
} from "./utils";
import { bundledDtsPath } from "./deno";

const denoExtensionId = "denoland.deno";
const pluginId = "typescript-deno-plugin";
const configurationSection = "deno";

const localize = nls.loadMessageBundle();

enum Status {
  ok = 1,
  warn = 2,
  error = 3,
}

interface StatusParams {
  state: Status;
}

interface WorkspaceFolderItem extends vscode.QuickPickItem {
  folder: vscode.WorkspaceFolder;
}

async function pickFolder(
  folders: vscode.WorkspaceFolder[],
  placeHolder: string,
): Promise<vscode.WorkspaceFolder> {
  if (folders.length === 1) {
    return Promise.resolve(folders[0]);
  }

  const selected = await vscode.window.showQuickPick(
    folders.map<WorkspaceFolderItem>((folder) => {
      return {
        label: folder.name,
        description: folder.uri.fsPath,
        folder: folder,
      };
    }),
    { placeHolder: placeHolder },
  );
  if (!selected) {
    return undefined;
  }
  return selected.folder;
}

function enable() {
  let folders = vscode.workspace.workspaceFolders;

  if (!folders) {
    vscode.window.showWarningMessage(
      "Deno can only be enabled if VS Code is opened on a workspace folder.",
    );
    return;
  }

  let disabledFolders = folders.filter(
    (folder) =>
      !vscode.workspace
        .getConfiguration(configurationSection, folder.uri)
        .get("enable", true),
  );

  if (disabledFolders.length === 0) {
    if (folders.length === 1) {
      vscode.window.showInformationMessage(
        "Deno is already enabled in the workspace.",
      );
    } else {
      vscode.window.showInformationMessage(
        "Deno is already enabled on all workspace folders.",
      );
    }
    return;
  }

  pickFolder(
    disabledFolders,
    "Select a workspace folder to enable Deno for",
  ).then((folder) => {
    if (!folder) {
      return;
    }
    vscode.workspace
      .getConfiguration(configurationSection, folder.uri)
      .update("enable", true)
      .then(restartTsServer);
  });
}

function disable() {
  let folders = vscode.workspace.workspaceFolders;

  if (!folders) {
    vscode.window.showErrorMessage(
      "Deno can only be disabled if VS Code is opened on a workspace folder.",
    );
    return;
  }

  let enabledFolders = folders.filter((folder) =>
    vscode.workspace
      .getConfiguration(configurationSection, folder.uri)
      .get("enable", true)
  );

  if (enabledFolders.length === 0) {
    if (folders.length === 1) {
      vscode.window.showInformationMessage(
        "Deno is already disabled in the workspace.",
      );
    } else {
      vscode.window.showInformationMessage(
        "Deno is already disabled on all workspace folders.",
      );
    }
    return;
  }

  pickFolder(
    enabledFolders,
    "Select a workspace folder to disable Deno for",
  ).then((folder) => {
    if (!folder) {
      return;
    }
    vscode.workspace.getConfiguration("deno", folder.uri).update(
      "enable",
      false,
    ).then(restartTsServer);
  });
}

interface SynchronizedConfiguration {
  alwaysShowStatus?: boolean;
  autoFmtOnSave?: boolean;
  enable?: boolean;
  importmap?: string;
  tsconfig?: string;
}

export async function activate(context: vscode.ExtensionContext) {
  const api = await getTypeScriptLanguageExtension();

  if (!api) {
    return;
  }

  await promptForNodeJsProject();

  const configurationListener = vscode.workspace.onDidChangeConfiguration(
    (e) => {
      if (e.affectsConfiguration(configurationSection)) {
        synchronizeConfiguration(api);
        updateStatusBarVisibility(vscode.window.activeTextEditor);
      }
    },
    undefined,
    context.subscriptions,
  );

  synchronizeConfiguration(api);

  const disposables = [
    configurationListener,
    // formatter,
    vscode.commands.registerCommand("deno.enable", enable),
    vscode.commands.registerCommand("deno.disable", disable),
    vscode.commands.registerCommand("deno.showOutputChannel", async () => {
      if (denoStatus === Status.ok) {
        outputChannel.show();
        return;
      }

      const show = localize("showOutputChannel", "Show Output");
      const help = localize("getHelp", "Get Help");

      const choice = await vscode.window.showWarningMessage(
        localize(
          "notfound",
          "Deno not found. Install it by using deno_install or click {0} button for more help.",
          help,
        ),
        show,
        help,
      );

      if (choice === show) {
        outputChannel.show();
      } else if (choice === help) {
        vscode.commands.executeCommand(
          "vscode.open",
          vscode.Uri.parse("https://github.com/denoland/deno_install"),
        );
      }
    }),
  ];

  context.subscriptions.push(...disposables, outputChannel);

  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    0,
  );
  let denoStatus: Status = Status.ok;

  statusBarItem.text = "Deno";
  statusBarItem.command = "deno.showOutputChannel";

  const versions = await getVersions();

  if (versions === undefined) {
    denoStatus = Status.warn;
    statusBarItem.tooltip = "Deno is not installed";
    outputChannel.appendLine("Failed to detect Deno.");
    outputChannel.appendLine("You can use one-line commands to install Deno.");
    if (process.platform === "win32") {
      outputChannel.appendLine(
        "> iwr https://deno.land/x/install/install.ps1 | iex",
      );
    } else {
      outputChannel.appendLine(
        "> curl -fsSL https://deno.land/x/install/install.sh | sh",
      );
    }
    outputChannel.appendLine(
      "See https://github.com/denoland/deno_install for more installation options.\n",
    );
  } else {
    statusBarItem.tooltip = versions.raw;
    outputChannel.appendLine("Found deno, version:");
    outputChannel.appendLine(versions.raw);
    generateDtsForDeno();
  }

  function showStatusBarItem(show: boolean): void {
    if (show) {
      statusBarItem.show();
    } else {
      statusBarItem.hide();
    }
  }

  function updateStatus(status: Status) {
    if (denoStatus !== Status.ok && status === Status.ok) {
      // an error got addressed fix, write to the output that the status is OK
      // client.info("vscode-deno: Status is OK");
    }
    denoStatus = status;
    updateStatusBarVisibility(vscode.window.activeTextEditor);
  }

  function updateStatusBarVisibility(
    editor: vscode.TextEditor | undefined,
  ): void {
    switch (denoStatus) {
      case Status.ok:
        statusBarItem.text = `Deno ${versions.deno}`;
        break;
      case Status.warn:
        statusBarItem.text = "$(alert) Deno";
        break;
      case Status.error:
        statusBarItem.text = "$(issue-opened) Deno";
        break;
      default:
        statusBarItem.text = `Deno ${versions.deno}`;
    }
    let uri = editor ? editor.document.uri : undefined;
    let enabled = vscode.workspace.getConfiguration("deno", uri)["enable"];
    let alwaysShowStatus = vscode.workspace.getConfiguration("deno", uri)[
      "alwaysShowStatus"
    ];

    if (
      !editor ||
      !enabled ||
      (denoStatus === Status.ok && !alwaysShowStatus)
    ) {
      showStatusBarItem(false);
      return;
    }

    showStatusBarItem(
      isTypeScriptDocument(editor.document) ||
        isJavaScriptDocument(editor.document),
    );
  }

  vscode.window.onDidChangeActiveTextEditor(updateStatusBarVisibility);
  updateStatusBarVisibility(vscode.window.activeTextEditor);

  // If the extension is launched in debug mode then the debug server options are used.
  // Otherwise the run options are used.
  const serverOptions: lsp.ServerOptions = {
    run: getServerOptions(context, false /* debug */),
    debug: getServerOptions(context, true /* debug */),
  };

  const config = vscode.workspace.getConfiguration();
  const fileEvents: vscode.FileSystemWatcher[] = [];

  // Notify the server about file changes to import maps contained in the workspace
  const importmap: string | null = config.get("deno.importmap");
  if (importmap) {
    fileEvents.push(vscode.workspace.createFileSystemWatcher(importmap));
  }

  // Notify the server about file changes to tsconfig.json contained in the workspace
  const tsconfig: string | null = config.get("deno.tsconfig");
  if (tsconfig) {
    fileEvents.push(vscode.workspace.createFileSystemWatcher(tsconfig));
  }

  // Options to control the language client
  const clientOptions: lsp.LanguageClientOptions = {
    // Register the server for JavaScript and TypeScript documents
    documentSelector: [
      // scheme: 'file' means listen to changes to files on disk only
      // other option is 'untitled', for buffer in the editor (like a new doc)
      // **NOTE**: REMOVE .wasm https://github.com/denoland/deno/pull/5135
      { scheme: "file", language: "javascript" },
      { scheme: "file", language: "javascriptreact" },
      { scheme: "file", language: "typescript" },
      { scheme: "file", language: "typescriptreact" },
    ],

    // Notify the server about file changes
    synchronize: { fileEvents },

    // Don't let our output console pop open
    revealOutputChannelOn: lsp.RevealOutputChannelOn.Never,
  };

  // Create the language client and start the client.
  const forceDebug = process.env["DENO_DEBUG"] === "true";
  const client = new lsp.LanguageClient(
    "Deno Language Service",
    serverOptions,
    clientOptions,
    forceDebug,
  );

  // Push the disposable to the context's subscriptions so that the
  // client can be deactivated on extension deactivation
  context.subscriptions.push(...registerCommands(client), client.start());

  client.onDidChangeState((e) => {
    let task: { resolve: () => void } | undefined;
    if (e.newState == lsp.State.Running) {
      client.onNotification(projectLoadingNotification.start, () => {
        if (task) {
          task.resolve();
          task = undefined;
        }
        vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Window,
            title: "Initializing Deno language service",
          },
          () =>
            new Promise((resolve) => {
              task = { resolve };
            }),
        );
      });

      client.onNotification(projectLoadingNotification.finish, () => {
        if (task) {
          task.resolve();
          task = undefined;
        }
      });
    }
  });
}

export function deactivate() {}

function synchronizeConfiguration(api: any) {
  const config = getConfiguration();

  api.configurePlugin(pluginId, {
    ...config,
    dtsPath: bundledDtsPath(
      vscode.extensions.getExtension(denoExtensionId).extensionPath,
    ),
  });
}

function getConfiguration(): SynchronizedConfiguration {
  const config = vscode.workspace.getConfiguration(configurationSection);
  const outConfig: SynchronizedConfiguration = {};

  withConfigValue(config, outConfig, "enable");
  withConfigValue(config, outConfig, "alwaysShowStatus");
  withConfigValue(config, outConfig, "autoFmtOnSave");
  withConfigValue(config, outConfig, "tsconfig");
  withConfigValue(config, outConfig, "importmap");

  return outConfig;
}

function withConfigValue<C, K extends Extract<keyof C, string>>(
  config: vscode.WorkspaceConfiguration,
  outConfig: C,
  key: K,
): void {
  const configSetting = config.inspect<C[K]>(key);
  if (!configSetting) {
    return;
  }

  // Make sure the user has actually set the value.
  // VS Code will return the default values instead of `undefined`, even if user has not don't set anything.
  if (
    typeof configSetting.globalValue === "undefined" &&
    typeof configSetting.workspaceFolderValue === "undefined" &&
    typeof configSetting.workspaceValue === "undefined"
  ) {
    return;
  }

  const value = config.get<C[K] | undefined>(key, undefined);

  if (typeof value !== "undefined") {
    outConfig[key] = value;
  }
}

/** when package.json is detected in the root directory, display a prompt */
async function promptForNodeJsProject(): Promise<void> {
  let enabled = vscode.workspace.getConfiguration("deno").get("enable", true);

  if (enabled && packageJsonExists()) {
    const disable = localize("button.disable", "Disable");
    const cancel = localize("button.cancel", "Cancel");
    const choice = await vscode.window.showInformationMessage(
      localize(
        "message.maybe_nodejs_project",
        "A package.json file is detected in the project. " +
          "This project may be a Node.js project. " +
          "Do you want to disable this extension?",
      ),
      disable,
      cancel,
    );

    if (choice === disable) {
      vscode.commands.executeCommand("deno.disable");
    }
  }
}

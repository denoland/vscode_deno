import {
  workspace,
  window,
  commands,
  extensions,
  ExtensionContext,
  StatusBarAlignment,
  TextEditor,
  WorkspaceFolder,
  QuickPickItem,
  WorkspaceConfiguration,
  Uri
} from "vscode";

import * as nls from "vscode-nls";

import { outputChannel } from "./output";
import {
  isTypeScriptDocument,
  isJavaScriptDocument,
  getVersions
} from "./utils";

const typeScriptExtensionId = "vscode.typescript-language-features";
const pluginId = "typescript-deno-plugin";
const configurationSection = "deno";

const localize = nls.loadMessageBundle();

enum Status {
  ok = 1,
  warn = 2,
  error = 3
}

interface StatusParams {
  state: Status;
}

interface WorkspaceFolderItem extends QuickPickItem {
  folder: WorkspaceFolder;
}

async function pickFolder(
  folders: WorkspaceFolder[],
  placeHolder: string
): Promise<WorkspaceFolder> {
  if (folders.length === 1) {
    return Promise.resolve(folders[0]);
  }

  const selected = await window.showQuickPick(
    folders.map<WorkspaceFolderItem>(folder => {
      return {
        label: folder.name,
        description: folder.uri.fsPath,
        folder: folder
      };
    }),
    { placeHolder: placeHolder }
  );
  if (!selected) {
    return undefined;
  }
  return selected.folder;
}

function enable() {
  let folders = workspace.workspaceFolders;

  if (!folders) {
    window.showWarningMessage(
      "Deno can only be enabled if VS Code is opened on a workspace folder."
    );
    return;
  }

  let disabledFolders = folders.filter(
    folder =>
      !workspace.getConfiguration("deno", folder.uri).get("enable", true)
  );

  if (disabledFolders.length === 0) {
    if (folders.length === 1) {
      window.showInformationMessage(
        "Deno is already enabled in the workspace."
      );
    } else {
      window.showInformationMessage(
        "Deno is already enabled on all workspace folders."
      );
    }
    return;
  }

  pickFolder(
    disabledFolders,
    "Select a workspace folder to enable Deno for"
  ).then(folder => {
    if (!folder) {
      return;
    }
    workspace.getConfiguration("deno", folder.uri).update("enable", true);
  });
}

function disable() {
  let folders = workspace.workspaceFolders;

  if (!folders) {
    window.showErrorMessage(
      "Deno can only be disabled if VS Code is opened on a workspace folder."
    );
    return;
  }

  let enabledFolders = folders.filter(folder =>
    workspace.getConfiguration("deno", folder.uri).get("enable", true)
  );

  if (enabledFolders.length === 0) {
    if (folders.length === 1) {
      window.showInformationMessage(
        "Deno is already disabled in the workspace."
      );
    } else {
      window.showInformationMessage(
        "Deno is already disabled on all workspace folders."
      );
    }
    return;
  }

  pickFolder(
    enabledFolders,
    "Select a workspace folder to disable Deno for"
  ).then(folder => {
    if (!folder) {
      return;
    }
    workspace.getConfiguration("deno", folder.uri).update("enable", false);
  });
}

interface SynchronizedConfiguration {
  alwaysShowStatus?: boolean;
  autoFmtOnSave?: boolean;
  enable?: boolean;
}

export async function activate(context: ExtensionContext) {
  const extension = extensions.getExtension(typeScriptExtensionId);
  if (!extension) {
    return;
  }

  await extension.activate();
  if (!extension.exports || !extension.exports.getAPI) {
    return;
  }

  const api = extension.exports.getAPI(0);
  if (!api) {
    return;
  }

  workspace.onDidChangeConfiguration(
    e => {
      if (e.affectsConfiguration(configurationSection)) {
        synchronizeConfiguration(api);
        updateStatusBarVisibility(window.activeTextEditor);
      }
    },
    undefined,
    context.subscriptions
  );

  synchronizeConfiguration(api);

  const disposables = [
    commands.registerCommand("deno.enable", enable),
    commands.registerCommand("deno.disable", disable),
    commands.registerCommand("deno.showOutputChannel", async () => {
      const show = localize("showOutputChannel", "Show Output");
      const help = localize("getHelp", "Get Help");

      const choice = await window.showWarningMessage(
        localize(
          "notfound",
          "Deno not found. Install it by using deno_install or click {0} button for more help.",
          help
        ),
        show,
        help
      );

      if (choice === show) {
        outputChannel.show();
      } else if (choice === help) {
        commands.executeCommand(
          "vscode.open",
          Uri.parse("https://github.com/denoland/deno_install")
        );
      }
    })
  ];

  context.subscriptions.push(...disposables, outputChannel);

  const statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 0);
  let denoStatus: Status = Status.ok;

  statusBarItem.text = "Deno";
  statusBarItem.command = "deno.showOutputChannel";

  const versions = await getVersions();

  if (versions === undefined) {
    denoStatus = Status.warn;
    statusBarItem.tooltip = "Deno does not installed";
    outputChannel.appendLine("Failed to detect Deno.");
    outputChannel.appendLine("You can use one-line commands to install Deno.");
    if (process.platform === "win32") {
      outputChannel.appendLine(
        "> iwr https://deno.land/x/install/install.ps1 | iex"
      );
    } else {
      outputChannel.appendLine(
        "> curl -fsSL https://deno.land/x/install/install.sh | sh"
      );
    }
    outputChannel.appendLine(
      "See https://github.com/denoland/deno_install for more installation options.\n"
    );
  } else {
    statusBarItem.tooltip = versions.text;
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
    updateStatusBarVisibility(window.activeTextEditor);
  }

  function updateStatusBarVisibility(editor: TextEditor | undefined): void {
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
    let enabled = workspace.getConfiguration("deno", uri)["enable"];
    let alwaysShowStatus = workspace.getConfiguration("deno", uri)[
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
        isJavaScriptDocument(editor.document)
    );
  }

  window.onDidChangeActiveTextEditor(updateStatusBarVisibility);
  updateStatusBarVisibility(window.activeTextEditor);
}

export function deactivate() {}

function synchronizeConfiguration(api: any) {
  api.configurePlugin(pluginId, getConfiguration());
}

function getConfiguration(): SynchronizedConfiguration {
  const config = workspace.getConfiguration(configurationSection);
  const outConfig: SynchronizedConfiguration = {};

  withConfigValue(config, outConfig, "enable");
  withConfigValue(config, outConfig, "alwaysShowStatus");
  withConfigValue(config, outConfig, "autoFmtOnSave");

  return outConfig;
}

function withConfigValue<C, K extends Extract<keyof C, string>>(
  config: WorkspaceConfiguration,
  outConfig: C,
  key: K
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

  const value = config.get<WorkspaceConfiguration[K] | undefined>(
    key,
    undefined
  );

  if (typeof value !== "undefined") {
    outConfig[key] = value;
  }
}

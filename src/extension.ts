import * as path from "path";
import { readFile, writeFile } from "fs";
import { promisify } from "util";

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
  languages,
  TextDocument,
  Range,
  TextEdit
} from "vscode";

import {
  isTypeScriptDocument,
  isJavaScriptDocument,
  isFilepathExist
} from "./utils";
import { deno, FormatableLanguages } from "./deno";

const typeScriptExtensionId = "vscode.typescript-language-features";
const pluginId = "typescript-deno-plugin";
const configurationSection = "deno";

interface WorkspaceFolderItem extends QuickPickItem {
  folder: WorkspaceFolder;
}

interface SynchronizedConfiguration {
  enable?: boolean;
  dtsPath?: string;
}

interface TypescriptAPI {
  configurePlugin(pluginId: string, configuration: {}): void;
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
  const folders = workspace.workspaceFolders;

  if (!folders) {
    window.showWarningMessage(
      "Deno can only be enabled if VS Code is opened on a workspace folder."
    );
    return;
  }

  const disabledFolders = folders.filter(
    folder =>
      !workspace
        .getConfiguration(configurationSection, folder.uri)
        .get("enable", true)
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
    workspace
      .getConfiguration(configurationSection, folder.uri)
      .update("enable", true);
  });
}

function disable() {
  const folders = workspace.workspaceFolders;

  if (!folders) {
    window.showErrorMessage(
      "Deno can only be disabled if VS Code is opened on a workspace folder."
    );
    return;
  }

  const enabledFolders = folders.filter(folder =>
    workspace
      .getConfiguration(configurationSection, folder.uri)
      .get("enable", true)
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
    workspace
      .getConfiguration(configurationSection, folder.uri)
      .update("enable", false);
  });
}

function synchronizeConfiguration(api: TypescriptAPI) {
  const config = getConfiguration();

  if (!config.dtsPath) {
    config.dtsPath = getDenoDtsFilepath();
  }

  if ("enable" in config === false) {
    config.enable = true;
  }

  api.configurePlugin(pluginId, config);
}

function getConfiguration(): SynchronizedConfiguration {
  const config = workspace.getConfiguration(configurationSection);
  const outConfig: SynchronizedConfiguration = {};

  withConfigValue(config, outConfig, "enable");
  withConfigValue(config, outConfig, "dtsPath");

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

  const value = config.get<C[K] | undefined>(key, undefined);

  if (typeof value !== "undefined") {
    outConfig[key] = value;
  }
}

function getDenoDtsFilepath(): string {
  return path.join(deno.DENO_DIR, "lib.deno_runtime.d.ts");
}

// get typescript api from build-in extension
// https://github.com/microsoft/vscode/blob/master/extensions/typescript-language-features/src/api.ts
async function getTypescriptAPI(): Promise<TypescriptAPI> {
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

  return api;
}

export async function activate(context: ExtensionContext) {
  try {
    await deno.init();
    const currentDenoTypesContent = await deno.getTypes();
    const typeFilepath = getDenoDtsFilepath();
    const isExistDtsFile = await isFilepathExist(typeFilepath);

    // if dst file not exist. then create a new one
    if (!isExistDtsFile) {
      await promisify(writeFile)(typeFilepath, currentDenoTypesContent, {
        encoding: "utf8"
      });
    } else {
      const typesContent = await promisify(readFile)(typeFilepath, {
        encoding: "utf8"
      });

      if (typesContent.toString() !== currentDenoTypesContent.toString()) {
        await promisify(writeFile)(typeFilepath, currentDenoTypesContent, {
          encoding: "utf8"
        });
      }
    }
  } catch (err) {
    await window.showErrorMessage(err.message);
    return;
  }

  const api = await getTypescriptAPI();

  if (!api) {
    window.showErrorMessage("Can not get Typescript APIs.");
    return;
  }

  synchronizeConfiguration(api);

  const statusBar = window.createStatusBarItem(StatusBarAlignment.Right, 0);

  statusBar.text = `Deno ${deno.version.deno}`;
  statusBar.tooltip = deno.version.raw;

  function updateStatusBarVisibility(editor: TextEditor | undefined): void {
    // not typescript | javascript file
    if (
      !isTypeScriptDocument(editor?.document) &&
      !isJavaScriptDocument(editor?.document)
    ) {
      statusBar.hide();
      return;
    }

    const uri = editor ? editor.document.uri : undefined;
    const enabled = workspace
      .getConfiguration(configurationSection, uri)
      .get("enable");

    // if vscode-deno have been disable for workspace
    if (!enabled) {
      statusBar.hide();
      return;
    }

    statusBar.show();
  }

  updateStatusBarVisibility(window.activeTextEditor);

  const disposables = [
    window.onDidChangeActiveTextEditor(updateStatusBarVisibility),
    workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration(configurationSection)) {
        synchronizeConfiguration(api);
        updateStatusBarVisibility(window.activeTextEditor);
      }
    }),
    languages.registerDocumentFormattingEditProvider(
      [
        "typescript",
        "typescriptreact",
        "javascript",
        "javascriptreact",
        "markdown",
        "json"
      ],
      {
        async provideDocumentFormattingEdits(document: TextDocument) {
          if (!deno.executablePath) {
            window.showWarningMessage("Can not found deno in $PATH");
            return [];
          }

          let formatted: string;

          const workspaceFolder = workspace.getWorkspaceFolder(document.uri);

          const cwd = workspaceFolder?.uri?.fsPath ?? document.uri.fsPath;

          try {
            formatted = await deno.format(
              document.getText(),
              document.languageId as FormatableLanguages,
              {
                cwd
              }
            );
          } catch (err) {
            window.showErrorMessage(err.message);
            return [];
          }

          const fullRange = new Range(
            document.positionAt(0),
            document.positionAt(document.getText().length)
          );
          return [new TextEdit(fullRange, formatted)];
        }
      }
    ),
    commands.registerCommand("deno.enable", enable),
    commands.registerCommand("deno.disable", disable)
  ];

  context.subscriptions.push(...disposables);
}

export function deactivate() {}

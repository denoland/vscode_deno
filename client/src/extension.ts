import * as path from "path";

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
  WorkspaceConfiguration
} from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from "vscode-languageclient";
import getport from "get-port";

const typeScriptExtensionId = "vscode.typescript-language-features";
const pluginId = "typescript-deno-plugin";
const configurationSection = "deno";

interface WorkspaceFolderItem extends QuickPickItem {
  folder: WorkspaceFolder;
}

interface SynchronizedConfiguration {
  enable?: boolean;
  dtsFilepaths?: string[];
}

interface TypescriptAPI {
  configurePlugin(pluginId: string, configuration: {}): void;
}

interface DenoInfo {
  DENO_DIR: string;
  version: string;
  executablePath: string;
  dtsFilepath: string;
}

let denoInfo: DenoInfo = {
  DENO_DIR: "",
  version: "",
  executablePath: "",
  dtsFilepath: ""
};

const config: SynchronizedConfiguration = {
  enable: true,
  dtsFilepaths: []
};

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

  if (!config.dtsFilepaths) {
    const dtsFilepath = denoInfo.dtsFilepath;
    if (dtsFilepath) {
      config.dtsFilepaths = [dtsFilepath];
    }
  }

  if ("enable" in config === false) {
    config.enable = true;
  }

  api.configurePlugin(pluginId, config);
}

function getConfiguration(): SynchronizedConfiguration {
  const _config = workspace.getConfiguration(configurationSection);

  withConfigValue(_config, config, "enable");
  withConfigValue(_config, config, "dtsFilepaths");

  return config;
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
  const api = await getTypescriptAPI();

  if (!api) {
    window.showErrorMessage("Can not get Typescript APIs.");
    return;
  }

  synchronizeConfiguration(api);

  const statusBar = window.createStatusBarItem(StatusBarAlignment.Right, 0);

  statusBar.text = `Deno ${denoInfo.version}`;
  statusBar.tooltip = denoInfo.executablePath;

  function updateStatusBarVisibility(editor: TextEditor | undefined): void {
    // if no editor
    if (!editor) {
      statusBar.hide();
      return;
    }
    // not typescript | javascript file
    if (
      ![
        "typescript",
        "typescriptreact",
        "javascript",
        "javascriptreact",
        "markdown",
        "json"
      ].includes(editor.document.languageId)
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

  const disposables = [
    window.onDidChangeActiveTextEditor(updateStatusBarVisibility),
    workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration(configurationSection)) {
        synchronizeConfiguration(api);
        updateStatusBarVisibility(window.activeTextEditor);
      }
    }),
    commands.registerCommand("deno.enable", enable),
    commands.registerCommand("deno.disable", disable)
  ];

  context.subscriptions.push(...disposables);

  // create server connection
  const port = await getport({ port: 9523 });

  // The server is implemented in node
  const serverModule = context.asAbsolutePath(
    path.join("server", "out", "server.js")
  );

  // The debug options for the server
  const debugOptions = { execArgv: ["--nolazy", `--inspect=${port}`] };

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions
    }
  };

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: "file", language: "javascript" },
      { scheme: "file", language: "javascriptreact" },
      { scheme: "file", language: "typescript" },
      { scheme: "file", language: "typescriptreact" },
      { scheme: "file", language: "markdown" },
      { scheme: "file", language: "json" }
    ],
    synchronize: {
      configurationSection: configurationSection
    },
    progressOnInitialization: true
  };

  // Create the language client and start the client.
  const client = new LanguageClient(
    "Deno Language Server",
    "Deno Language Server",
    serverOptions,
    clientOptions
  );

  client.onReady().then(() => {
    console.log("Deno Language Server is ready!");
    client.onNotification("init", (info: DenoInfo) => {
      denoInfo = { ...denoInfo, ...info };
      statusBar.text = `Deno ${denoInfo.version}`;
      statusBar.tooltip = denoInfo.executablePath;
      synchronizeConfiguration(api);
    });
    client.onNotification("error", (message: string) => {
      window.showErrorMessage(message);
    });

    context.subscriptions.push(
      workspace.onDidOpenTextDocument(document => {
        const workspaceFolder = workspace.getWorkspaceFolder(document.uri);

        const workspaceFilepath =
          workspaceFolder?.uri.fsPath ||
          path.dirname(document.uri.fsPath) ||
          process.cwd();

        client.sendNotification("workspace", workspaceFilepath);
      })
    );
  });

  context.subscriptions.push(client.start());

  console.log(`Congratulations, your extension "vscode-deno" is now active!`);
}

export function deactivate() {}

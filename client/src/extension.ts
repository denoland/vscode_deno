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
  WorkspaceConfiguration,
  Uri,
  StatusBarItem
} from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from "vscode-languageclient";
import getport from "get-port";

const TYPESCRIPT_EXTENSION_NAME = "vscode.typescript-language-features";
const TYPESCRIPT_DENO_PLUGIN_ID = "typescript-deno-plugin";

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

async function pickFolder(
  folders: WorkspaceFolder[],
  placeHolder: string
): Promise<WorkspaceFolder> {
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

// get typescript api from build-in extension
// https://github.com/microsoft/vscode/blob/master/extensions/typescript-language-features/src/api.ts
async function getTypescriptAPI(): Promise<TypescriptAPI> {
  const extension = extensions.getExtension(TYPESCRIPT_EXTENSION_NAME);
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

class Extension {
  // extension context
  private context: ExtensionContext;
  // typescript API
  private tsAPI: TypescriptAPI;
  // LSP client
  private client: LanguageClient;
  private configurationSection = "deno";
  // status bar
  private statusBar: StatusBarItem;
  // Deno Information from Deno Language Server
  private denoInfo: DenoInfo = {
    DENO_DIR: "",
    version: "",
    executablePath: "",
    dtsFilepath: ""
  };
  // get configuration of Deno
  private getConfiguration(uri: Uri): SynchronizedConfiguration {
    const config: SynchronizedConfiguration = {};
    const _config = workspace.getConfiguration(this.configurationSection, uri);

    function withConfigValue<C, K extends Extract<keyof C, string>>(
      config: WorkspaceConfiguration,
      outConfig: C,
      key: K
    ): void {
      const configSetting = config.inspect<C[K]>(key);
      if (!configSetting) {
        return;
      }

      outConfig[key] =
        configSetting.workspaceFolderValue ??
        configSetting.workspaceValue ??
        configSetting.globalValue;
    }

    withConfigValue(_config, config, "enable");
    withConfigValue(_config, config, "dtsFilepaths");

    if (!config.dtsFilepaths) {
      const dtsFilepath = this.denoInfo.dtsFilepath;
      if (dtsFilepath) {
        config.dtsFilepaths = [dtsFilepath];
      }
    }

    if ("enable" in config === false) {
      config.enable = false;
    }

    return config;
  }
  // register command for deno extension
  private registerCommand(
    command: string,
    handler: () => void | Promise<void>
  ) {
    this.context.subscriptions.push(
      commands.registerCommand(
        this.configurationSection + "." + command,
        handler
      )
    );
  }
  // watch deno configuration change
  private watchConfiguration(handler: () => void | Promise<void>) {
    this.context.subscriptions.push(
      workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration(this.configurationSection)) {
          handler();
        }
      })
    );
  }
  // start Deno Language Server
  private async StartDenoLanguageServer() {
    // create server connection
    const port = await getport({ port: 9523 });

    // The server is implemented in node
    const serverModule = this.context.asAbsolutePath(
      path.join("server", "out", "server.js")
    );

    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    const serverOptions: ServerOptions = {
      run: {
        module: serverModule,
        transport: TransportKind.ipc,
        options: { cwd: process.cwd() }
      },
      debug: {
        module: serverModule,
        transport: TransportKind.ipc,
        options: {
          cwd: process.cwd(),
          execArgv: ["--nolazy", `--inspect=${port}`]
        }
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
      diagnosticCollectionName: this.configurationSection,
      synchronize: {
        configurationSection: this.configurationSection
      },
      progressOnInitialization: true
    };

    // Create the language client and start the client.
    const client = (this.client = new LanguageClient(
      "Deno Language Server",
      "Deno Language Server",
      serverOptions,
      clientOptions
    ));

    client.onReady().then(() => {
      console.log("Deno Language Server is ready!");
      client.onNotification("init", (info: DenoInfo) => {
        this.denoInfo = { ...this.denoInfo, ...info };
        this.statusBar.text = `Deno ${this.denoInfo.version}`;
        this.statusBar.tooltip = this.denoInfo.executablePath;
        this.updateStatusBarVisibility(window.activeTextEditor);
      });
      client.onNotification("error", window.showErrorMessage);

      client.onRequest("getWorkspaceFolder", async (uri: string) =>
        workspace.getWorkspaceFolder(Uri.parse(uri))
      );

      client.onRequest("getWorkspaceConfig", async (uri: string) => {
        const workspaceFolder = workspace.getWorkspaceFolder(Uri.parse(uri));

        const config = this.getConfiguration(
          workspaceFolder?.uri || Uri.parse(uri)
        );

        return config;
      });
    });

    this.context.subscriptions.push(client.start());
  }
  // update status bar visibility
  private updateStatusBarVisibility(
    editor: TextEditor | undefined = window.activeTextEditor
  ): void {
    // if no editor
    if (!editor) {
      this.statusBar.hide();
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
      this.statusBar.hide();
      return;
    }

    const uri = editor ? editor.document.uri : undefined;
    const enabled = workspace
      .getConfiguration(this.configurationSection, uri)
      .get("enable");

    // if vscode-deno have been disable for workspace
    if (!enabled) {
      this.statusBar.hide();
      return;
    }

    this.statusBar.show();
  }
  // enable Deno Extension
  private enable() {
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
          .getConfiguration(this.configurationSection, folder.uri)
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
        .getConfiguration(this.configurationSection, folder.uri)
        .update("enable", true);
    });
  }
  // disable Deno Extension
  private disable() {
    const folders = workspace.workspaceFolders;

    if (!folders) {
      window.showErrorMessage(
        "Deno can only be disabled if VS Code is opened on a workspace folder."
      );
      return;
    }

    const enabledFolders = folders.filter(folder =>
      workspace
        .getConfiguration(this.configurationSection, folder.uri)
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
        .getConfiguration(this.configurationSection, folder.uri)
        .update("enable", false);
    });
  }
  public async activate(context: ExtensionContext) {
    this.context = context;
    this.tsAPI = await getTypescriptAPI();

    this.statusBar = window.createStatusBarItem(StatusBarAlignment.Right, 0);

    this.context.subscriptions.push(this.statusBar);

    this.registerCommand("enable", this.enable.bind(this));
    this.registerCommand("disable", this.disable.bind(this));
    this.watchConfiguration(() => {
      const uri = window.activeTextEditor?.document.uri;
      if (uri) {
        this.tsAPI.configurePlugin(
          TYPESCRIPT_DENO_PLUGIN_ID,
          this.getConfiguration(uri)
        );
      }
      this.updateStatusBarVisibility(window.activeTextEditor);
    });

    this.context.subscriptions.push(
      workspace.onDidOpenTextDocument(() => {
        const uri = window.activeTextEditor?.document.uri;
        this.tsAPI.configurePlugin(
          TYPESCRIPT_DENO_PLUGIN_ID,
          this.getConfiguration(uri)
        );
      })
    );

    this.context.subscriptions.push(
      window.onDidChangeActiveTextEditor(
        this.updateStatusBarVisibility.bind(this)
      )
    );

    await this.StartDenoLanguageServer();

    console.log(`Congratulations, your extension "vscode-deno" is now active!`);
  }
  public async deactivate(context: ExtensionContext) {
    this.context = context;

    if (!this.client) {
      return;
    }

    await this.client.stop();
  }
}

const ext = new Extension();

const activate = ext.activate.bind(ext);
const deactivate = ext.deactivate.bind(ext);

export { activate, deactivate };

import * as path from "path";
import { promises as fs } from "fs";

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
  StatusBarItem,
  Range,
  OutputChannel,
  Diagnostic,
  CodeActionContext
} from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from "vscode-languageclient";
import getport from "get-port";
import execa from "execa";
import { init, localize } from "vscode-nls-i18n";

const TYPESCRIPT_EXTENSION_NAME = "vscode.typescript-language-features";
const TYPESCRIPT_DENO_PLUGIN_ID = "typescript-deno-plugin";

interface WorkspaceFolderItem extends QuickPickItem {
  folder: WorkspaceFolder;
}

interface SynchronizedConfiguration {
  enable?: boolean;
  dtsFilepaths?: string[];
  import_map?: string;
  // external
  workspaceDir?: string;
}

interface TypescriptAPI {
  configurePlugin(pluginId: string, configuration: {}): void;
}

interface DenoInfo {
  DENO_DIR: string;
  version: {
    deno: string;
    v8: string;
    typescript: string;
    raw: string;
  };
  executablePath: string;
  dtsFilepath: string;
}

interface ImportMap {
  imports: { [key: string]: string; };
}

function exists(filepath: string): Promise<boolean> {
  return fs
    .stat(filepath)
    .then(() => Promise.resolve(true))
    .catch(() => Promise.resolve(false));
}

async function getImportMaps(importMapFilepath: string, workspaceDir: string) {
  let importMaps: ImportMap = {
    imports: {}
  };

  //  try resolve import maps
  if (importMapFilepath) {
    const importMapsFilepath = path.isAbsolute(importMapFilepath)
      ? importMapFilepath
      : path.resolve(workspaceDir || process.cwd(), importMapFilepath);

    if (await exists(importMapsFilepath)) {
      const importMapContent = await fs.readFile(importMapsFilepath);

      try {
        importMaps = JSON.parse(importMapContent.toString() || "{}");
      } catch {
      }
    }
  }

  return importMaps;
}

function resolveModuleFromImportMap(
  importMaps: ImportMap,
  moduleName: string
): string {
  const maps = importMaps.imports || {};

  for (const prefix in maps) {
    const mapModule = maps[prefix];

    const reg = new RegExp("^" + prefix);
    if (reg.test(moduleName)) {
      moduleName = moduleName.replace(reg, mapModule);
    }
  }

  return moduleName;
}

async function pickFolder(
  folders: WorkspaceFolder[],
  placeHolder: string,
  multipleWorkspaces: boolean
): Promise<WorkspaceFolder> {
  if (!multipleWorkspaces && folders.length === 1) {
    return folders[0];
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
  // output channel
  private output: OutputChannel;
  // Deno Information from Deno Language Server
  private denoInfo: DenoInfo = {
    DENO_DIR: "",
    version: {
      deno: "",
      v8: "",
      typescript: "",
      raw: ""
    },
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

      outConfig[key] = configSetting.workspaceFolderValue ??
        configSetting.workspaceValue ??
        configSetting.globalValue;
    }

    withConfigValue(_config, config, "enable");
    withConfigValue(_config, config, "dtsFilepaths");
    withConfigValue(_config, config, "import_map");

    if (!config.dtsFilepaths) {
      const dtsFilepath = this.denoInfo.dtsFilepath;
      if (dtsFilepath) {
        config.dtsFilepaths = [dtsFilepath];
      }
    }

    if ("enable" in config === false) {
      config.enable = false;
    }

    const workspaceFolder = workspace.getWorkspaceFolder(uri);

    if (workspaceFolder) {
      config.workspaceDir = workspaceFolder.uri.fsPath;
    }

    return config;
  }
  // register command for deno extension
  private registerCommand(
    command: string,
    handler: (...argv: any[]) => void | Promise<void>
  ) {
    this.context.subscriptions.push(
      commands.registerCommand(
        this.configurationSection + "." + command,
        handler.bind(this)
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
    if (this.client) {
      await this.client.stop();
      this.client = null;
    }
    const statusbar = window.createStatusBarItem(
      StatusBarAlignment.Left,
      -100
    );
    statusbar.text = `$(loading) ${localize("deno.initializing")}`;
    statusbar.show();

    try {
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
          options: {
            cwd: process.cwd(),
            env: {
              VSCODE_DENO_EXTENSION_PATH_PATH: this.context.extensionPath,
              VSCODE_NLS_CONFIG: process.env.VSCODE_NLS_CONFIG
            }
          }
        },
        debug: {
          module: serverModule,
          transport: TransportKind.ipc,
          options: {
            cwd: process.cwd(),
            execArgv: ["--nolazy", `--inspect=${port}`],
            env: {
              VSCODE_DENO_EXTENSION_PATH_PATH: this.context.extensionPath,
              VSCODE_NLS_CONFIG: process.env.VSCODE_NLS_CONFIG
            }
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
        progressOnInitialization: true,
        middleware: {
          provideCodeActions: (document, range, context, token, next) => {
            // do not ask server for code action when the diagnostic isn't from deno
            if (!context.diagnostics || context.diagnostics.length === 0) {
              return [];
            }
            const denoDiagnostics: Diagnostic[] = [];
            for (const diagnostic of context.diagnostics) {
              if (diagnostic.source === "Deno Language Server") {
                denoDiagnostics.push(diagnostic);
              }
            }
            if (denoDiagnostics.length === 0) {
              return [];
            }
            const newContext: CodeActionContext = Object.assign({}, context, {
              diagnostics: denoDiagnostics
            } as CodeActionContext);
            return next(document, range, newContext, token);
          }
        }
      };

      // Create the language client and start the client.
      const client = (this.client = new LanguageClient(
        "Deno Language Server",
        "Deno Language Server",
        serverOptions,
        clientOptions
      ));

      this.context.subscriptions.push(client.start());

      await client.onReady().then(() => {
        console.log("Deno Language Server is ready!");
        client.onNotification("init", (info: DenoInfo) => {
          this.denoInfo = { ...this.denoInfo, ...info };
          this.updateStatusBarVisibility(window.activeTextEditor);
        });
        client.onNotification("error", window.showErrorMessage);

        client.onRequest(
          "getWorkspaceFolder",
          async (uri: string) => workspace.getWorkspaceFolder(Uri.parse(uri))
        );

        client.onRequest("getWorkspaceConfig", async (uri: string) => {
          const workspaceFolder = workspace.getWorkspaceFolder(Uri.parse(uri));

          const config = this.getConfiguration(
            workspaceFolder?.uri || Uri.parse(uri)
          );

          return config;
        });
      });
    } catch (err) {
      throw err;
    } finally {
      statusbar.hide();
      statusbar.dispose();
    }
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

    this.statusBar.text = `Deno ${this.denoInfo.version.deno}`;
    this.statusBar.tooltip = `Deno ${this.denoInfo.version.deno}
TypeScript ${this.denoInfo.version.typescript}
V8 ${this.denoInfo.version.v8}
Executable ${this.denoInfo.executablePath}`;

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
      folder => !workspace
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
      "Select a workspace folder to enable Deno for",
      folders.length > 1
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

    const enabledFolders = folders.filter(folder => workspace
      .getConfiguration(this.configurationSection, folder.uri)
      .get("enable", true));

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
      "Select a workspace folder to disable Deno for",
      folders.length > 1
    ).then(folder => {
      if (!folder) {
        return;
      }
      workspace
        .getConfiguration(this.configurationSection, folder.uri)
        .update("enable", false);
    });
  }
  // register quickly fix code action
  private registerQuickFix(map: {
    [command: string]: (editor: TextEditor, text: string, range: Range) => void
      | Promise<void>;
  }) {
    for (let command in map) {
      const handler = map[command];
      this.registerCommand(command, async (uri: string, range: Range) => {
        const textEditor = window.activeTextEditor;

        if (!textEditor || textEditor.document.uri.toString() !== uri) {
          return;
        }

        range = new Range(
          range.start.line,
          range.start.character,
          range.end.line,
          range.end.character
        );

        const rangeText = textEditor.document.getText(range);

        return await handler.call(this, textEditor, rangeText, range);
      });
    }
  }
  // update diagnostic for a Document
  private updateDiagnostic(uri: Uri) {
    this.client.sendNotification("updateDiagnostic", uri.toString());
  }
  // activate function for vscode
  public async activate(context: ExtensionContext) {
    init(context.extensionPath);
    this.context = context;
    this.tsAPI = await getTypescriptAPI();

    this.tsAPI.configurePlugin(
      TYPESCRIPT_DENO_PLUGIN_ID,
      this.getConfiguration(window.activeTextEditor?.document.uri)
    );

    this.statusBar = window.createStatusBarItem(StatusBarAlignment.Right, 0);

    this.context.subscriptions.push(this.statusBar);

    this.output = window.createOutputChannel("Deno");
    this.context.subscriptions.push(this.output);

    this.context.subscriptions.push(
      window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
          this.updateDiagnostic(editor.document.uri);
        }
      })
    );

    this.registerCommand("enable", this.enable.bind(this));
    this.registerCommand("disable", this.disable.bind(this));
    this.registerCommand(
      "restart_server",
      this.StartDenoLanguageServer.bind(this)
    );

    this.registerQuickFix({
      _add_missing_extension: async (editor, text, range) => {
        await editor.edit(e => e.replace(range, text + ".ts"));
      },
      _use_https_module: async (editor, text, range) => {
        await editor.edit(e => {
          e.replace(range, text.replace(/^http/, "https"));
        });
      },
      _fetch_remote_module: async (editor, text) => {
        const config = await this.getConfiguration(editor.document.uri);
        const workspaceFolder = workspace.getWorkspaceFolder(
          editor.document.uri
        );
        const remoteModuleUrl = resolveModuleFromImportMap(
          await getImportMaps(
            config.import_map,
            workspaceFolder?.uri.fsPath || process.cwd()
          ),
          text
        );

        const ps = execa(this.denoInfo.executablePath, [
          "fetch",
          remoteModuleUrl
        ]);

        this.output.show();

        ps.stdout.on("data", buf => {
          this.output.append(buf + "");
        });

        ps.stderr.on("data", buf => {
          this.output.append(buf + "");
        });

        await new Promise((resolve, reject) => {
          ps.on("exit", (code: number) => {
            this.output.appendLine(`exit with code: ${code}`);
            this.updateDiagnostic(editor.document.uri);
            resolve();
          });
        });
      },
      _create_local_module: async (editor, text) => {
        const extName = path.extname(text);

        if (extName === "") {
          this.output.appendLine(
            `Cannot create module \`${text
              }\` without specifying extension name`
          );
          this.output.show();
          return;
        }

        if (text.indexOf(".") !== 0 || text.indexOf("/") !== 0) {
          this.output.appendLine(
            `Cannot create module \`${text
              }\`. Module is not relative or absolute`
          );
          this.output.show();
          return;
        }

        let defaultTextContent = "";

        switch (extName) {
          case ".json":
            defaultTextContent = "{}";
          case ".js":
          case ".jsx":
          case ".ts":
          case ".tsx":
            defaultTextContent = "export function example () {}";
            break;
        }

        const absModuleFilepath = path.isAbsolute(text)
          ? text
          : path.resolve(path.dirname(editor.document.uri.fsPath), text);

        this.output.appendLine(`create module \`${absModuleFilepath}\``);

        await fs.writeFile(absModuleFilepath, defaultTextContent);

        this.updateDiagnostic(editor.document.uri);
      },
      _lock_std_version: (editor, text, range) => {
        editor.edit(e => e.replace(
          range,
          text.replace(
            "https://deno.land/std/",
            `https://deno.land/std@v${this.denoInfo.version.deno}/`
          )
        ));
      }
    });

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

    console
      .log(`Congratulations, your extension "vscode-deno" is now active!`);
  }
  // deactivate function for vscode
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

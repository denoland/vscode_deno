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
  WorkspaceConfiguration,
  Uri,
  StatusBarItem,
  Range,
  OutputChannel,
  Diagnostic,
  CodeActionContext,
  ProgressLocation,
  TextDocument,
  languages,
  env,
} from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient";
import getport from "get-port";
import execa from "execa";
import * as semver from "semver";

import { TreeViewProvider } from "./tree_view_provider";
import { ImportEnhancementCompletionProvider } from "./import_enhancement_provider";

import { ImportMap } from "../../core/import_map";
import { HashMeta } from "../../core/hash_meta";
import { isInDeno } from "../../core/deno";
import { isValidDenoDocument } from "../../core/util";
import { Request, Notification } from "../../core/const";
import {
  ConfigurationField,
  DenoPluginConfigurationField,
} from "../../core/configuration";

const TYPESCRIPT_EXTENSION_NAME = "vscode.typescript-language-features";
const TYPESCRIPT_DENO_PLUGIN_ID = "typescript-deno-plugin";

type TypescriptAPI = {
  configurePlugin(pluginId: string, configuration: ConfigurationField): void;
};

type DenoInfo = {
  DENO_DIR: string;
  version: {
    deno: string;
    v8: string;
    typescript: string;
    raw: string;
  };
  executablePath: string;
};

// get typescript api from build-in extension
// https://github.com/microsoft/vscode/blob/master/extensions/typescript-language-features/src/api.ts
async function getTypescriptAPI(): Promise<TypescriptAPI> {
  const extension = extensions.getExtension(TYPESCRIPT_EXTENSION_NAME);
  const err = new Error(
    "Cannot get typescript APIs. try restart Visual Studio Code."
  );

  if (!extension) {
    throw err;
  }

  await extension.activate();

  if (!extension.exports || !extension.exports.getAPI) {
    throw err;
  }

  const api = extension.exports.getAPI(0);

  if (!api) {
    throw err;
  }

  return api;
}

export class Extension {
  // the name of this extension
  private id = "denoland.vscode-deno";
  // extension context
  public context!: ExtensionContext;
  // typescript API
  private tsAPI!: TypescriptAPI;
  // LSP client
  public client: LanguageClient | undefined;
  private clientReady = false;
  private configurationSection = "deno";
  // status bar
  private statusBar!: StatusBarItem;
  // output channel
  private output!: OutputChannel;
  // Deno Information from Deno Language Server
  private denoInfo: DenoInfo = {
    DENO_DIR: "",
    version: {
      deno: "",
      v8: "",
      typescript: "",
      raw: "",
    },
    executablePath: "",
  };
  // CGQAQ: ImportEnhancementCompletionProvider instance
  private import_enhancement_completion_provider = new ImportEnhancementCompletionProvider();

  // get configuration of Deno
  public getConfiguration(uri?: Uri): ConfigurationField {
    const config: ConfigurationField = {};
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

      outConfig[key] = (configSetting.workspaceFolderValue ??
        configSetting.workspaceValue ??
        configSetting.globalValue ??
        configSetting.defaultValue) as C[K];
    }

    for (const field of DenoPluginConfigurationField) {
      withConfigValue(_config, config, field);
    }

    return config;
  }
  // register command for deno extension
  private registerCommand(
    command: string,
    handler: (...argv: never[]) => void | Promise<void>
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
      workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration(this.configurationSection)) {
          handler();
        }
      })
    );
  }
  // start Deno Language Server
  private async StartDenoLanguageServer() {
    await window.withProgress(
      {
        location: ProgressLocation.Window,
        title: "Initializing Deno Language Server...",
      },
      async () => {
        if (this.client) {
          await this.client.stop();
          this.client = undefined;
          this.clientReady = false;
        }

        // create server connection
        const port = await getport({ port: 9523 });

        // The server is implemented in node
        const serverModule = this.context.asAbsolutePath(
          path.join("server", "out", "server", "src", "server.js")
        );

        // If the extension is launched in debug mode then the debug server options are used
        // Otherwise the run options are used
        const serverOptions: ServerOptions = {
          run: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: {
              cwd: this.context.extensionPath,
              env: {
                VSCODE_DENO_EXTENSION_PATH: this.context.extensionPath,
                VSCODE_NLS_CONFIG: process.env.VSCODE_NLS_CONFIG,
              },
            },
          },
          debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: {
              cwd: this.context.extensionPath,
              execArgv: ["--nolazy", `--inspect=${port}`],
              env: {
                VSCODE_DENO_EXTENSION_PATH: this.context.extensionPath,
                VSCODE_NLS_CONFIG: process.env.VSCODE_NLS_CONFIG,
              },
            },
          },
        };

        // Options to control the language client
        const clientOptions: LanguageClientOptions = {
          documentSelector: [
            { scheme: "file", language: "javascript" },
            { scheme: "file", language: "javascriptreact" },
            { scheme: "file", language: "typescript" },
            { scheme: "file", language: "typescriptreact" },
          ],
          diagnosticCollectionName: this.configurationSection,
          synchronize: {
            configurationSection: this.configurationSection,
          },
          progressOnInitialization: true,
          middleware: {
            provideCodeActions: (document, range, context, token, next) => {
              if (!this.getConfiguration(document.uri).enable) {
                return [];
              }
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
                diagnostics: denoDiagnostics,
              } as CodeActionContext);
              return next(document, range, newContext, token);
            },
            provideCompletionItem: (
              document,
              position,
              context,
              token,
              next
            ) => {
              if (!this.getConfiguration(document.uri).enable) {
                return [];
              }

              return next(document, position, context, token);
            },
            provideCodeLenses: (document, token, next) => {
              if (!isInDeno(document.uri.fsPath)) {
                return;
              }
              return next(document, token);
            },
          },
        };

        // Create the language client and start the client.
        const client = (this.client = new LanguageClient(
          "Deno Language Server",
          "Deno Language Server",
          serverOptions,
          clientOptions
        ));

        this.context.subscriptions.push(client.start());

        await client.onReady();

        this.clientReady = true;

        client.onNotification(Notification.init, (info: DenoInfo) => {
          this.denoInfo = { ...this.denoInfo, ...info };
          this.updateStatusBarVisibility(window.activeTextEditor?.document);
        });
        client.onNotification(
          Notification.error,
          window.showErrorMessage.bind(window)
        );

        client.onRequest(Request.getWorkspaceFolder, async (uri: string) =>
          workspace.getWorkspaceFolder(Uri.parse(uri))
        );

        client.onRequest(Request.getWorkspaceConfig, async (uri: string) => {
          const workspaceFolder = workspace.getWorkspaceFolder(Uri.parse(uri));

          const config = this.getConfiguration(
            workspaceFolder?.uri || Uri.parse(uri)
          );

          return config;
        });
      }
    );
  }
  // update status bar visibility
  private updateStatusBarVisibility(document: TextDocument | undefined): void {
    // if no editor
    if (!document) {
      this.statusBar.hide();
      return;
    }
    // not typescript | javascript file
    if (!isValidDenoDocument(document.languageId)) {
      this.statusBar.hide();
      return;
    }

    const uri = document.uri;
    const enabled = workspace
      .getConfiguration(this.configurationSection, uri)
      .get("enable");

    // if vscode-deno have been disable for workspace
    if (!enabled) {
      this.statusBar.hide();
      return;
    }

    if (this.statusBar) {
      this.statusBar.text = `Deno ${this.denoInfo.version.deno}`;
      this.statusBar.tooltip = `Deno ${this.denoInfo.version.deno}
TypeScript ${this.denoInfo.version.typescript}
V8 ${this.denoInfo.version.v8}
Executable ${this.denoInfo.executablePath}`;

      this.statusBar.show();
    }
  }
  // register quickly fix code action
  private registerQuickFix(map: {
    [command: string]: (
      editor: TextEditor,
      text: string,
      range: Range
    ) => void | Promise<void>;
  }) {
    for (const command in map) {
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
    if (this.client && this.clientReady) {
      this.client.sendNotification(Notification.diagnostic, uri.toString());
    }
  }
  private sync(document?: TextDocument) {
    if (document) {
      const relativeFilepath = workspace.asRelativePath(
        document.uri.fsPath,
        false
      );
      if (
        isValidDenoDocument(document.languageId) &&
        !path.isAbsolute(relativeFilepath)
      ) {
        const config = this.getConfiguration(document.uri);

        commands.executeCommand(
          "setContext",
          "denoExtensionActivated",
          !!config.enable
        );

        this.tsAPI.configurePlugin(TYPESCRIPT_DENO_PLUGIN_ID, config);
        this.updateDiagnostic(document.uri);
      }
    }
    this.updateStatusBarVisibility(window.activeTextEditor?.document);
  }
  private async setDocumentLanguage(document?: TextDocument) {
    if (!document) {
      return;
    }
    if (
      document.isUntitled ||
      document.languageId.toLowerCase() !== "plaintext"
    ) {
      return;
    }

    const filepath = document.uri.fsPath;

    if (isInDeno(filepath)) {
      const meta = HashMeta.create(filepath + ".metadata.json");
      if (meta) {
        await languages.setTextDocumentLanguage(
          document,
          meta.type.toLocaleLowerCase()
        );
      }
    }
  }
  // activate function for vscode
  public async activate(context: ExtensionContext): Promise<void> {
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
      window.onDidChangeActiveTextEditor(async (editor) => {
        this.sync(editor?.document);
        await this.setDocumentLanguage(editor?.document);
      })
    );

    this.context.subscriptions.push(
      workspace.onDidOpenTextDocument(async (document) => {
        this.sync(document);
      })
    );

    this.registerCommand("restart_server", async () => {
      this.StartDenoLanguageServer();
    });

    this.registerCommand("_copy_text", async (text: string) => {
      await env.clipboard.writeText(text);
      await window.showInformationMessage(`Copied to clipboard.`);
    });

    // CGQAQ: deno._clear_import_enhencement_cache
    this.registerCommand("_clear_import_enhencement_cache", async () => {
      await this.import_enhancement_completion_provider.clearCache();
    });

    this.registerQuickFix({
      _fetch_remote_module: async (editor, text) => {
        const config = this.getConfiguration(editor.document.uri);
        const workspaceFolder = workspace.getWorkspaceFolder(
          editor.document.uri
        );

        if (!workspaceFolder) {
          return;
        }

        const importMapFilepath = config.import_map
          ? path.isAbsolute(config.import_map)
            ? config.import_map
            : path.resolve(workspaceFolder.uri.fsPath, config.import_map)
          : undefined;

        const importMap = ImportMap.create(importMapFilepath);

        const moduleName = importMap.resolveModule(text);

        this.output.appendLine(`Fetching "${moduleName}"`);

        await window.withProgress(
          {
            title: `Fetching`,
            location: ProgressLocation.Notification,
            cancellable: true,
          },
          (process, cancelToken) => {
            // `deno fetch xxx` has been renamed to `deno cache xxx` since Deno v0.40.0
            const cmd = semver.gte(this.denoInfo.version.deno, "0.40.0")
              ? "cache"
              : "fetch";
            const ps = execa(this.denoInfo.executablePath, [cmd, moduleName], {
              // timeout of 2 minute
              timeout: 1000 * 60 * 2,
            });

            const updateProgress: (buf: Buffer) => void = (buf: Buffer) => {
              const raw = buf.toString();

              const messages = raw.split("\n");

              for (let message of messages) {
                message = message.replace("[0m[38;5;10mDownload[0m", "").trim();
                if (message) {
                  process.report({ message });
                  this.output.appendLine(message);
                }
              }
            };

            cancelToken.onCancellationRequested(ps.kill.bind(ps));

            ps.stdout?.on("data", updateProgress);
            ps.stderr?.on("data", updateProgress);

            return new Promise((resolve) => {
              ps.on("exit", (code: number) => {
                if (code !== 0 && !cancelToken.isCancellationRequested) {
                  this.output.show();
                }
                this.output.appendLine(`exit with code: ${code}`);
                this.updateDiagnostic(editor.document.uri);
                resolve();
              });
            });
          }
        );
      },
      _create_local_module: async (editor, text) => {
        const extName = path.extname(text);

        if (extName === "") {
          this.output.appendLine(
            `Cannot create module \`${text}\` without specifying extension name`
          );
          this.output.show();
          return;
        }

        if (text.indexOf(".") !== 0 && text.indexOf("/") !== 0) {
          this.output.appendLine(
            `Cannot create module \`${text}\`. Module is not relative or absolute`
          );
          this.output.show();
          return;
        }

        let defaultTextContent = "";

        switch (extName) {
          case ".js":
          case ".jsx":
          case ".ts":
          case ".tsx":
            defaultTextContent = "export function example () {}";
            break;
          default:
            this.output.appendLine(`Unknown module \`${text}\``);
            this.output.show();
            return;
        }

        const absModuleFilepath = path.isAbsolute(text)
          ? text
          : path.resolve(path.dirname(editor.document.uri.fsPath), text);

        this.output.appendLine(`create module \`${absModuleFilepath}\``);

        await fs.writeFile(absModuleFilepath, defaultTextContent);

        this.updateDiagnostic(editor.document.uri);
      },
    });

    this.watchConfiguration(() => {
      this.sync(window.activeTextEditor?.document);
    });

    await this.StartDenoLanguageServer();

    const treeView = new TreeViewProvider(this);
    this.context.subscriptions.push(treeView);

    this.context.subscriptions.push(
      window.registerTreeDataProvider("deno", treeView)
    );

    // CGQAQ: activate import enhance feature
    this.import_enhancement_completion_provider.activate(this.context);

    this.sync(window.activeTextEditor?.document);

    const extension = extensions.getExtension(this.id);

    console.log(
      `Congratulations, your extension "${this.id} ${extension?.packageJSON["version"]}" is now active!`
    );
  }
  // deactivate function for vscode
  public async deactivate(context: ExtensionContext): Promise<void> {
    this.context = context;

    this.import_enhancement_completion_provider.dispose();

    if (this.client) {
      await this.client.stop();
      this.client = undefined;
      this.clientReady = false;
    }
  }
}

const ext = new Extension();

const activate = ext.activate.bind(ext);
const deactivate = ext.deactivate.bind(ext);

export { activate, deactivate };

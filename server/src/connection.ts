// Copyright 2019-2020 the Deno authors. All rights reserved. MIT license.
// Copyright Google Inc. and other 'vscode-ng-language-service' contributors. All Rights Reserved.
// Use of this source code is governed by an MIT-style license that can be
// found in the LICENSE file at https://angular.io/license

import ts from "typescript/lib/tsserverlibrary";
import * as lsp from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { Logger } from "./logger";
import { ProjectService, DenoPluginOptions } from "./project_service";
import { projectLoadingNotification } from "./protocol";
import { ServerHost } from "./server_host";
import * as deno from "./utils/deno";
import {
  uriToFilePath,
  filePathToUri,
  tsDiagnosticToLspDiagnostic,
} from "./utils";
import { FixItems } from "./code_actions";
import {
  Disposable,
  DocumentFormattingRequest,
  DocumentRangeFormattingRequest,
} from "vscode-languageserver";

export interface ConnectionOptions {
  serverName: string;
  host: ServerHost;
  logger: Logger;
  deno: DenoPluginOptions;
  pluginProbeLocations?: string[];
}

const LanguageTsIds = [
  "javascript",
  "javascriptreact",
  "typescript",
  "typescriptreact",
];

// Empty definition range for files without `scriptInfo`
const EMPTY_RANGE = lsp.Range.create(0, 0, 0, 0);

/**
 * Connection is a wrapper around lsp.IConnection, with all the necessary protocol
 * handlers installed for Deno language service.
 */
export class Connection {
  private readonly connection: lsp.IConnection;
  private readonly projectService: ProjectService;
  private readonly documents: lsp.TextDocuments<TextDocument>;
  private readonly serverName: string;
  private diagnosticsTimeout: NodeJS.Timeout | null = null;
  private isProjectLoading = false;
  private documentFormatters: Disposable[] = [];

  constructor(options: ConnectionOptions) {
    // Create a connection for the server. The connection uses Node's IPC as a transport.
    this.connection = lsp.createConnection();
    this.documents = new lsp.TextDocuments(TextDocument);
    this.serverName = options.serverName;
    this.addProtocolHandlers(this.connection);
    this.addDocumentHandlers(this.documents);
    this.projectService = new ProjectService(
      {
        host: options.host,
        logger: options.logger,
        cancellationToken: ts.server.nullCancellationToken,
        useSingleInferredProject: true,
        useInferredProjectPerProjectRoot: true,
        typingsInstaller: ts.server.nullTypingsInstaller,
        // Not supressing diagnostic events can cause a type error to be thrown when the
        // language server session gets an event for a file that is outside the project
        // managed by the project service, and for which a program does not exist in the
        // corresponding project's language service.
        // See https://github.com/angular/vscode-ng-language-service/issues/693
        suppressDiagnosticEvents: true,
        eventHandler: (e) => this.handleProjectServiceEvent(e),
        globalPlugins: ["typescript-deno-plugin"],
        pluginProbeLocations: options.pluginProbeLocations,
        allowLocalPluginLoads: false, // do not load plugins from tsconfig.json
      },
      options.deno,
    );
  }

  private addProtocolHandlers(conn: lsp.IConnection) {
    conn.onInitialize((p) => this.onInitialize(p));
    conn.onDidOpenTextDocument((p) => this.onDidOpenTextDocument(p));
    conn.onDidCloseTextDocument((p) => this.onDidCloseTextDocument(p));
    conn.onDidSaveTextDocument((p) => this.onDidSaveTextDocument(p));
    conn.onDocumentFormatting((p) => this.onDocumentFormatting(p));
    conn.onDocumentRangeFormatting((p) => this.onDocumentRangeFormatting(p));
    conn.onCodeAction((p) => this.onCodeAction(p));
    conn.onDidChangeConfiguration((p) => this.onDidChangeConfiguration(p));
  }

  /**
   * An event handler that gets invoked whenever the program changes and
   * TS ProjectService sends `ProjectUpdatedInBackgroundEvent`. This particular
   * event is used to trigger diagnostic checks.
   * @param event
   */
  private handleProjectServiceEvent(event: ts.server.ProjectServiceEvent) {
    this.log("handleProjectServiceEvent");
    switch (event.eventName) {
      case ts.server.ProjectLoadingStartEvent:
        this.isProjectLoading = true;
        this.log("project loading");
        this.connection.sendNotification(projectLoadingNotification.start);
        break;
      case ts.server.ProjectLoadingFinishEvent: {
        const { project } = event.data;
        try {
          // Disable language service if project is not Deno
          this.checkIsDenoProject(project);
        } finally {
          if (this.isProjectLoading) {
            this.isProjectLoading = false;
            this.log("project load finish");
            this.connection.sendNotification(projectLoadingNotification.finish);
          }
        }
        break;
      }
      case ts.server.ProjectsUpdatedInBackgroundEvent:
        // ProjectsUpdatedInBackgroundEvent is sent whenever diagnostics are
        // requested via project.refreshDiagnostics()
        this.triggerDiagnostics(event.data.openFiles);
        break;
    }
  }

  /**
   * Retrieve Deno diagnostics for the specified `openFiles` after a specific
   * `delay`, or renew the request if there's already a pending one.
   * @param openFiles
   * @param delay time to wait before sending request (milliseconds)
   */
  private triggerDiagnostics(openFiles: string[], delay: number = 200) {
    // Do not immediately send a diagnostics request. Send only after user has
    // stopped typing after the specified delay.
    if (this.diagnosticsTimeout) {
      // If there's an existing timeout, cancel it
      clearTimeout(this.diagnosticsTimeout);
    }
    // Set a new timeout
    this.diagnosticsTimeout = setTimeout(() => {
      this.diagnosticsTimeout = null; // clear the timeout
      this.sendPendingDiagnostics(openFiles);
      // Default delay is 200ms, consistent with TypeScript. See
      // https://github.com/microsoft/vscode/blob/7b944a16f52843b44cede123dd43ae36c0405dfd/extensions/typescript-language-features/src/features/bufferSyncSupport.ts#L493)
    }, delay);
  }

  /**
   * Execute diagnostics request for each of the specified `openFiles`.
   * @param openFiles
   */
  private sendPendingDiagnostics(openFiles: string[]) {
    for (const fileName of openFiles) {
      const scriptInfo = this.projectService.getScriptInfo(fileName);
      if (!scriptInfo) {
        continue;
      }

      const tsLS = this.projectService.getDefaultLanguageService(scriptInfo);
      if (!tsLS) {
        continue;
      }

      const diagnostics = tsLS.getSemanticDiagnostics(fileName);
      // Need to send diagnostics even if it's empty otherwise editor state will
      // not be updated.
      this.connection.sendDiagnostics({
        uri: filePathToUri(fileName),
        diagnostics: diagnostics.map((d) =>
          tsDiagnosticToLspDiagnostic(d, scriptInfo)
        ),
      });
    }
  }

  private onInitialize(params: lsp.InitializeParams): lsp.InitializeResult {
    return {
      capabilities: {
        documentFormattingProvider: false,
        documentRangeFormattingProvider: false,
        textDocumentSync: {
          openClose: true,
          change: lsp.TextDocumentSyncKind.Full,
        },
        codeActionProvider: {
          codeActionKinds: [lsp.CodeActionKind.QuickFix],
        },
      },
    };
  }

  private onDidOpenTextDocument(params: lsp.DidOpenTextDocumentParams) {
    const { uri, languageId, text } = params.textDocument;
    this.log(`open ${uri}`);
    const filePath = uriToFilePath(uri);
    if (!filePath) {
      return;
    }
    const scriptKind = LanguageTsIds.includes(languageId)
      ? ts.ScriptKind.TS
      : ts.ScriptKind.External;
    try {
      const result = this.projectService.openClientFile(
        filePath,
        text,
        scriptKind,
      );

      const { configFileName, configFileErrors } = result;
      if (configFileErrors && configFileErrors.length) {
        // configFileErrors is an empty array even if there's no error, so check length.
        this.connection.console.error(
          configFileErrors.map((e) => e.messageText).join("\n"),
        );
      }
      if (!configFileName) {
        this.connection.console.error(`No config file for ${filePath}`);
        return;
      }
      const project = this.projectService.findProject(configFileName);
      if (!project) {
        this.connection.console.error(`Failed to find project for ${filePath}`);
        return;
      }
      if (project.languageServiceEnabled) {
        project.refreshDiagnostics(); // Show initial diagnostics
      }
    } catch (error) {
      if (this.isProjectLoading) {
        this.isProjectLoading = false;
        this.connection.sendNotification(projectLoadingNotification.finish);
      }
      if (error.stack) {
        this.error(error.stack);
      }
      throw error;
    }
  }

  private onDidCloseTextDocument(params: lsp.DidCloseTextDocumentParams) {
    const { textDocument } = params;
    const filePath = uriToFilePath(textDocument.uri);
    if (!filePath) {
      return;
    }
    this.projectService.closeClientFile(filePath);
  }

  private onDidSaveTextDocument(params: lsp.DidSaveTextDocumentParams) {
    const { text, textDocument } = params;
    const filePath = uriToFilePath(textDocument.uri);
    const scriptInfo = this.projectService.getScriptInfo(filePath);
    if (!scriptInfo) {
      return;
    }
    if (text) {
      scriptInfo.open(text);
    } else {
      scriptInfo.reloadFromFile();
    }
  }

  private async onDocumentFormatting(params: lsp.DocumentFormattingParams) {
    const { textDocument } = params;
    const doc = this.documents.get(textDocument.uri);
    if (!doc) {
      return;
    }

    const text = doc.getText();
    const formatted = await deno.format(text);

    const start = doc.positionAt(0);
    const end = doc.positionAt(text.length);
    const range = lsp.Range.create(start, end);

    return [lsp.TextEdit.replace(range, formatted)];
  }

  private async onDocumentRangeFormatting(
    params: lsp.DocumentRangeFormattingParams,
  ) {
    const { range, textDocument } = params;
    const doc = this.documents.get(textDocument.uri);
    if (!doc) {
      return;
    }

    const text = doc.getText(range);
    const formatted = await deno.format(text);

    // why trim it?
    // Because we are just formatting some of them, we don't need to keep the trailing \n
    return [lsp.TextEdit.replace(range, formatted.trim())];
  }

  private async onCodeAction(params: lsp.CodeActionParams) {
    const { context, textDocument } = params;
    const diagnostics = context.diagnostics;
    if (diagnostics.length === 0) {
      return;
    }

    const actions: lsp.CodeAction[] = [];
    for (const diag of diagnostics) {
      if (!diag.code) {
        continue;
      }

      const item = FixItems[diag.code];
      if (!item) {
        continue;
      }

      const action = lsp.CodeAction.create(
        `${item.title} (${this.serverName})`,
        lsp.Command.create(
          item.title,
          item.command,
          textDocument.uri,
          {
            start: {
              line: diag.range.start.line,
              character: diag.range.start.character,
            },
            end: {
              line: diag.range.end.line,
              character: diag.range.end.character,
            },
          },
        ),
        lsp.CodeActionKind.QuickFix,
      );

      actions.push(action);
    }

    return actions;
  }

  private addDocumentHandlers(docs: lsp.TextDocuments<TextDocument>): void {
    docs.onDidOpen((e) => this.onDidOpen(e));
  }

  private onDidOpen(e: lsp.TextDocumentChangeEvent<TextDocument>) {
    this.log("Open file: " + e.document.uri);
    this.triggerDiagnostics([uriToFilePath(e.document.uri)]);
  }

  private async onDidChangeConfiguration(
    { settings }: lsp.DidChangeConfigurationParams,
  ) {
    // onDidChangeConfiguration will fire for Language Server startup
    await this.setupFormatters(settings);
  }

  private async setupFormatters(settings: any) {
    if (settings.deno.enableFormatter === true) {
      if (this.documentFormatters.length === 0) {
        const documentSelector = [
          // scheme: 'file' means listen to changes to files on disk only
          // other option is 'untitled', for buffer in the editor (like a new doc)
          // **NOTE**: REMOVE .wasm https://github.com/denoland/deno/pull/5135
          { scheme: "file", language: "javascript" },
          { scheme: "file", language: "javascriptreact" },
          { scheme: "file", language: "typescript" },
          { scheme: "file", language: "typescriptreact" },
        ];

        const documentFormatter = await this.connection.client.register(
          DocumentFormattingRequest.type,
          { documentSelector },
        );
        const documentRangeFormatter = await this.connection.client.register(
          DocumentRangeFormattingRequest.type,
          { documentSelector },
        );

        this.documentFormatters.push(documentFormatter, documentRangeFormatter);
      }
    } else {
      this.documentFormatters.forEach((formatter) => formatter.dispose());
      this.documentFormatters = [];
    }
  }

  /**
   * Show an error message.
   *
   * @param message The message to show.
   */
  error(message: string): void {
    this.connection.console.error(message);
  }

  /**
   * Show a warning message.
   *
   * @param message The message to show.
   */
  warn(message: string): void {
    this.connection.console.warn(message);
  }

  /**
   * Show an information message.
   *
   * @param message The message to show.
   */
  info(message: string): void {
    this.connection.console.info(message);
  }

  /**
   * Log a message.
   *
   * @param message The message to log.
   */
  log(message: string): void {
    this.connection.console.log(message);
  }

  /**
   * Start listening on the input stream for messages to process.
   */
  listen() {
    this.documents.listen(this.connection);
    this.connection.listen();
  }

  /**
   * Determine if the specified `project` is Deno, and disable the language
   * service if not.
   * @param project
   */
  private checkIsDenoProject(project: ts.server.Project) {
    const DENO_MOD = "mod.ts";
    const { projectName } = project;

    if (!project.languageServiceEnabled) {
      const msg = `Language service is already disabled for ${projectName}. ` +
        `This could be due to non-TS files that exceeded the size limit (${ts.server.maxProgramSizeForNonTsFiles} bytes).` +
        `Please check log file for details.`;
      this.connection.console.info(msg); // log to remote console to inform users
      project.log(msg); // log to file, so that it's easier to correlate with ts entries

      return;
    }

    if (!deno.isDenoProject(project, DENO_MOD)) {
      project.disableLanguageService();
      const msg =
        `Disabling language service for ${projectName} because it is not an Deno project ` +
        `('${DENO_MOD}' could not be found). `;
      this.connection.console.info(msg);
      project.log(msg);

      return;
    }

    // The language service should be enabled at this point.
    this.connection.console.info(
      `Enabling language service for ${projectName}.`,
    );
  }
}

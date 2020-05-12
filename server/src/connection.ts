// Copyright 2019-2020 the Deno authors. All rights reserved. MIT license.
// Copyright Google Inc. and other 'vscode-ng-language-service' contributors. All Rights Reserved.
// Use of this source code is governed by an MIT-style license that can be
// found in the LICENSE file at https://angular.io/license

import ts from "typescript/lib/tsserverlibrary";
import * as lsp from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { Logger } from "./logger";
import { ProjectService } from "./project_service";
import { projectLoadingNotification } from "./protocol";
import { ServerHost } from "./server_host";
import * as deno from "./utils/deno";
import { uriToFilePath } from "./utils";

export interface ConnectionOptions {
  host: ServerHost;
  logger: Logger;
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
  private diagnosticsTimeout: NodeJS.Timeout | null = null;
  private isProjectLoading = false;

  constructor(options: ConnectionOptions) {
    // Create a connection for the server. The connection uses Node's IPC as a transport.
    this.connection = lsp.createConnection();
    this.documents = new lsp.TextDocuments(TextDocument);
    this.addProtocolHandlers(this.connection);
    this.projectService = new ProjectService({
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
    });
  }

  private addProtocolHandlers(conn: lsp.IConnection) {
    conn.onInitialize((p) => this.onInitialize(p));
    conn.onDidOpenTextDocument((p) => this.onDidOpenTextDocument(p));
    conn.onDidCloseTextDocument((p) => this.onDidCloseTextDocument(p));
    conn.onDidSaveTextDocument((p) => this.onDidSaveTextDocument(p));
    conn.onDocumentFormatting((p) => this.onDocumentFormatting(p));
    conn.onDocumentRangeFormatting((p) => this.onDocumentRangeFormatting(p));
  }

  /**
   * An event handler that gets invoked whenever the program changes and
   * TS ProjectService sends `ProjectUpdatedInBackgroundEvent`. This particular
   * event is used to trigger diagnostic checks.
   * @param event
   */
  private handleProjectServiceEvent(event: ts.server.ProjectServiceEvent) {
    this.connection.console.log("handleProjectServiceEvent");
    switch (event.eventName) {
      case ts.server.ProjectLoadingStartEvent:
        this.isProjectLoading = true;
        this.connection.console.log("project loading");
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
            this.connection.console.log("project load finish");
            this.connection.sendNotification(projectLoadingNotification.finish);
          }
        }
        break;
      }
    }
  }

  private onInitialize(params: lsp.InitializeParams): lsp.InitializeResult {
    return {
      capabilities: {
        documentFormattingProvider: true,
        documentRangeFormattingProvider: true,
        textDocumentSync: lsp.TextDocumentSyncKind.Full,
      },
    };
  }

  private onDidOpenTextDocument(params: lsp.DidOpenTextDocumentParams) {
    const { uri, languageId, text } = params.textDocument;
    this.connection.console.log(`open ${uri}`);
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

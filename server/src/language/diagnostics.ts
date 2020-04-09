import * as path from "path";

import {
  IConnection,
  Diagnostic,
  DiagnosticSeverity,
  CodeAction,
  CodeActionKind,
  Command,
  TextDocuments,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import * as ts from "typescript";
import { URI } from "vscode-uri";
import { localize } from "vscode-nls-i18n";

import { Bridge } from "../bridge";
import { ModuleResolver } from "../../../core/module_resolver";
import { pathExists, isHttpURL, isValidDenoDocument } from "../../../core/util";
import { ImportMap } from "../../../core/import_map";
import { getImportModules, Range } from "../../../core/deno_deps";
import { Notification } from "../../../core/const";

type Fix = {
  title: string;
  command: string;
};

enum DiagnosticCode {
  InvalidImport = 1000,
  LocalModuleNotExist = 1004,
  RemoteModuleNotExist = 1005,
}

const FixItems: { [code: number]: Fix } = {
  [DiagnosticCode.LocalModuleNotExist]: {
    title: localize("diagnostic.fix.create_module"),
    command: "deno._create_local_module",
  },
  [DiagnosticCode.RemoteModuleNotExist]: {
    title: localize("diagnostic.fix.fetch_module"),
    command: "deno._fetch_remote_module",
  },
};

export class Diagnostics {
  constructor(
    private name: string,
    private connection: IConnection,
    private bridge: Bridge,
    private documents: TextDocuments<TextDocument>
  ) {
    connection.onCodeAction(async (params) => {
      const { context, textDocument } = params;
      const { diagnostics } = context;
      const denoDiagnostics = diagnostics.filter((v) => v.source === this.name);

      if (!denoDiagnostics.length) {
        return;
      }

      const actions: CodeAction[] = denoDiagnostics
        .map((v) => {
          const code = v.code;

          if (!code) {
            return;
          }

          const fixItem: Fix = FixItems[+code];

          if (!fixItem) {
            return;
          }

          const action = CodeAction.create(
            `${fixItem.title} (${this.name})`,
            Command.create(
              fixItem.title,
              fixItem.command,
              // argument
              textDocument.uri,
              {
                start: {
                  line: v.range.start.line,
                  character: v.range.start.character,
                },
                end: {
                  line: v.range.end.line,
                  character: v.range.end.character,
                },
              }
            ),
            CodeActionKind.QuickFix
          );

          return action;
        })
        .filter((v) => v) as CodeAction[];

      return actions;
    });

    connection.onNotification(Notification.diagnostic, (uri: string) => {
      const document = this.documents.get(uri);
      document && this.diagnosis(document);
    });

    documents.onDidOpen((params) => this.diagnosis(params.document));
    documents.onDidChangeContent((params) => this.diagnosis(params.document));
  }
  async generate(document: TextDocument): Promise<Diagnostic[]> {
    if (!isValidDenoDocument(document.languageId)) {
      return [];
    }

    // get workspace config
    const [config, workspaceDir] = await Promise.all([
      this.bridge.getWorkspaceConfig(document.uri),
      this.bridge.getWorkspace(document.uri),
    ]);

    if (!config.enable || !workspaceDir) {
      return [];
    }

    const importMapFilepath = config.import_map
      ? path.isAbsolute(config.import_map)
        ? config.import_map
        : path.resolve(workspaceDir.uri.fsPath, config.import_map)
      : undefined;

    const uri = URI.parse(document.uri);

    // Parse a file
    const sourceFile = ts.createSourceFile(
      uri.fsPath,
      document.getText(),
      ts.ScriptTarget.ESNext,
      true,
      ts.ScriptKind.TSX
    );

    const importModules = getImportModules(ts)(sourceFile);

    const diagnosticsForThisDocument: Diagnostic[] = [];
    const resolver = ModuleResolver.create(uri.fsPath, importMapFilepath);

    const handle = async (originModuleName: string, location: Range) => {
      const importModuleName = originModuleName;

      const [resolvedModule] = resolver.resolveModules([importModuleName]);

      if (
        !resolvedModule ||
        (await pathExists(resolvedModule.filepath)) === false
      ) {
        const moduleName = resolvedModule
          ? resolvedModule.origin
          : ImportMap.create(importMapFilepath).resolveModule(importModuleName);

        if (isHttpURL(moduleName)) {
          diagnosticsForThisDocument.push(
            Diagnostic.create(
              location,
              localize(
                "diagnostic.report.module_not_found_locally",
                moduleName
              ),
              DiagnosticSeverity.Error,
              DiagnosticCode.RemoteModuleNotExist,
              this.name
            )
          );
          return;
        }

        console.log(moduleName);

        if (
          path.isAbsolute(moduleName) ||
          moduleName.startsWith(".") ||
          moduleName.startsWith("file://")
        ) {
          diagnosticsForThisDocument.push(
            Diagnostic.create(
              location,
              localize(
                "diagnostic.report.module_not_found_locally",
                moduleName
              ),
              DiagnosticSeverity.Error,
              DiagnosticCode.LocalModuleNotExist,
              this.name
            )
          );
          return;
        }

        // invalid module
        diagnosticsForThisDocument.push(
          Diagnostic.create(
            location,
            localize("diagnostic.report.invalid_import", moduleName),
            DiagnosticSeverity.Error,
            DiagnosticCode.InvalidImport,
            this.name
          )
        );
      }
    };

    for (const importModule of importModules) {
      await handle(importModule.moduleName, importModule.location);
      if (importModule.hint) {
        await handle(importModule.hint.text, importModule.hint.contentRange);
      }
    }

    return diagnosticsForThisDocument;
  }
  /**
   * @deprecated since version 2.0
   * @param document
   */
  async diagnosis(document: TextDocument): Promise<void> {
    this.connection.sendDiagnostics({
      uri: document.uri,
      version: document.version,
      diagnostics: await this.generate(document),
    });
  }
}

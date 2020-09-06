import * as path from "path";

import {
  IConnection,
  Diagnostic,
  DiagnosticSeverity,
  CodeAction,
  CodeActionKind,
  Command,
  TextDocuments,
  Range,
  Position,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import * as ts from "typescript";
import { URI } from "vscode-uri";

import { Bridge } from "../bridge";
import { ModuleResolver } from "../../../core/module_resolver";
import { pathExists, isHttpURL, isValidDenoDocument } from "../../../core/util";
import { ImportMap } from "../../../core/import_map";
import { getImportModules } from "../../../core/deno_deps";
import { Notification } from "../../../core/const";
import { deno } from "../deno";

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
    title: "Create the module",
    command: "deno._create_local_module",
  },
  [DiagnosticCode.RemoteModuleNotExist]: {
    title: "Fetch the module",
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

      const rules = await deno.getLintRules();

      const actions: CodeAction[] = [];

      const documentAction = denoDiagnostics
        .filter((v) => v.code && FixItems[+v.code])
        .map((v) => {
          const fixItem: Fix = FixItems[+(v.code as string)];

          const action = CodeAction.create(
            `${fixItem.title} (${this.name})`,
            Command.create(
              fixItem.title,
              fixItem.command,
              // argument
              textDocument.uri,
              v.range
            ),
            CodeActionKind.QuickFix
          );

          return action;
        });

      const denoLintAction = denoDiagnostics
        .filter((v) => v.code && rules.includes(v.code as string))
        .map((v) => {
          const action = CodeAction.create(
            `ignore \`${v.code}\` for this line (${this.name})`,
            Command.create(
              "Fix lint",
              `deno._ignore_text_line_lint`,
              // argument
              textDocument.uri,
              v.range,
              v.code
            ),
            CodeActionKind.QuickFix
          );

          return action;
        });

      if (denoLintAction.length) {
        denoLintAction.push(
          CodeAction.create(
            `ignore entire file (${this.name})`,
            Command.create(
              "Fix lint",
              `deno._ignore_entry_file`,
              // argument
              textDocument.uri,
              Range.create(Position.create(0, 0), Position.create(0, 0)),
              "deno_lint"
            ),
            CodeActionKind.QuickFix
          )
        );
      }

      return actions.concat(documentAction).concat(denoLintAction);
    });

    connection.onNotification(Notification.diagnostic, (uri: string) => {
      const document = this.documents.get(uri);
      document && this.diagnosis(document);
    });

    documents.onDidOpen((params) => this.diagnosis(params.document));
    documents.onDidChangeContent((params) => this.diagnosis(params.document));
  }
  /**
   * lint document
   * @param document
   */
  async lint(document: TextDocument): Promise<Diagnostic[]> {
    const lintOutput = await deno.lint(document.getText());

    return lintOutput.diagnostics.map((v) => {
      const start = Position.create(v.range.start.line - 1, v.range.start.col);
      const end = Position.create(v.range.end.line - 1, v.range.end.col);
      const range = Range.create(start, end);

      return Diagnostic.create(
        range,
        v.message,
        DiagnosticSeverity.Error,
        v.code,
        this.name
      );
    });
  }
  /**
   * generate diagnostic for a document
   * @param document
   */
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

    const diagnosticsForThisDocument: Diagnostic[] = [];

    if (config.unstable && config.lint) {
      const denoLinterResult = await this.lint(document);

      for (const v of denoLinterResult) {
        diagnosticsForThisDocument.push(v);
      }
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
              `Could not find module "${moduleName}" locally.`,
              DiagnosticSeverity.Error,
              DiagnosticCode.RemoteModuleNotExist,
              this.name
            )
          );
          return;
        }

        if (
          path.isAbsolute(moduleName) ||
          moduleName.startsWith("./") ||
          moduleName.startsWith("../") ||
          moduleName.startsWith("file://")
        ) {
          diagnosticsForThisDocument.push(
            Diagnostic.create(
              location,
              `Could not find module "${moduleName}" locally.`,
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
            `Import module "${moduleName}" must be a relative path or remote HTTP URL.`,
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

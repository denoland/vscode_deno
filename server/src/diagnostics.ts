import {
  IConnection,
  Range,
  Diagnostic,
  DiagnosticSeverity
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import * as ts from "typescript";

import { Bridge } from "./bridge";

export class Diagnostics {
  constructor(
    private name: string,
    private connection: IConnection,
    private bridge: Bridge
  ) {}
  async generate(document: TextDocument): Promise<Diagnostic[]> {
    if (!["typescript", "typescriptreact"].includes(document.languageId)) {
      return;
    }

    // get workspace config
    const config = await this.bridge.getWorkspaceConfig(document.uri);

    if (!config.enable) {
      this.connection.sendDiagnostics({
        uri: document.uri,
        version: document.version,
        diagnostics: []
      });
      return;
    }

    let sourceFile;
    try {
      // Parse a file
      sourceFile = ts.createSourceFile(
        document.uri.toString(),
        document.getText(),
        ts.ScriptTarget.ESNext,
        false,
        ts.ScriptKind.TSX
      );
    } catch (err) {
      return;
    }

    const moduleNodes: ts.LiteralLikeNode[] = [];

    function delint(SourceFile: ts.SourceFile) {
      delintNode(SourceFile);

      function delintNode(node: ts.Node) {
        let moduleNode: ts.LiteralLikeNode | null = null;
        switch (node.kind) {
          // import('xxx')
          case ts.SyntaxKind.CallExpression:
            const expression = (node as ts.CallExpression).expression;
            const args = (node as ts.CallExpression).arguments;
            const isDynamicImport =
              expression?.kind === ts.SyntaxKind.ImportKeyword;
            if (isDynamicImport) {
              const argv = args[0] as ts.StringLiteral;

              if (argv && ts.isStringLiteral(argv)) {
                moduleNode = argv;
              }
            }
            break;
          // import ts = require('typescript')
          case ts.SyntaxKind.ImportEqualsDeclaration:
            const ref = (node as ts.ImportEqualsDeclaration)
              .moduleReference as ts.ExternalModuleReference;

            if (ref.expression && ts.isStringLiteral(ref.expression)) {
              moduleNode = ref.expression;
            }
            break;
          // import * as from 'xx'
          // import 'xx'
          // import xx from 'xx'
          case ts.SyntaxKind.ImportDeclaration:
            const spec = (node as ts.ImportDeclaration).moduleSpecifier;
            if (spec && ts.isStringLiteral(spec)) {
              moduleNode = spec;
            }
            break;
          // export { window } from "xxx";
          // export * from "xxx";
          case ts.SyntaxKind.ExportDeclaration:
            const exportSpec = (node as ts.ExportDeclaration).moduleSpecifier;
            if (exportSpec && ts.isStringLiteral(exportSpec)) {
              moduleNode = exportSpec;
            }
            break;
        }

        if (moduleNode) {
          moduleNodes.push(moduleNode);
        }

        ts.forEachChild(node, delintNode);
      }
    }

    // delint it
    delint(sourceFile);

    const validExtensionNameMap = {
      ".ts": true,
      ".tsx": true,
      ".js": true,
      ".jsx": true,
      ".json": true,
      ".wasm": true
    };

    const invalidImportModulesDiagnostics: Diagnostic[] = moduleNodes
      .map(moduleNode => {
        const numberOfSpaces = Math.abs(
          // why plus 2?
          // because `moduleNode.text` only contain the plaintext without two quotes
          moduleNode.end - moduleNode.pos - (moduleNode.text.length + 2)
        );

        const range = Range.create(
          document.positionAt(moduleNode.pos + numberOfSpaces),
          document.positionAt(moduleNode.end)
        );

        if (
          /^\..+/.test(moduleNode.text) === false &&
          /^https?:\/\/.*/.test(moduleNode.text) === false
        ) {
          return Diagnostic.create(
            range,
            `Deno only supports importting \`relative/HTTP\` module.`,
            DiagnosticSeverity.Error,
            1001,
            this.name
          );
        }

        {
          const [extensionName] = moduleNode.text.match(/\.[a-zA-Z\d]+$/) ||
            [];

          if (!validExtensionNameMap[extensionName]) {
            return Diagnostic.create(
              range,
              `Please specify valid extension name of the imported module.`,
              DiagnosticSeverity.Error,
              1002,
              this.name
            );
          }
        }

        if (/^https?:\/\//.test(moduleNode.text)) {
          if (/^https:\/\//.test(moduleNode.text) === false) {
            const range = Range.create(
              document.positionAt(moduleNode.pos),
              document.positionAt(moduleNode.end)
            );

            return Diagnostic.create(
              range,
              `For security, we recommend using the HTTPS module.`,
              DiagnosticSeverity.Warning,
              1003,
              this.name
            );
          }
        }

        return;
      })
      .filter(v => v);

    return invalidImportModulesDiagnostics;
  }
  async diagnosis(document: TextDocument): Promise<void> {
    this.connection.sendDiagnostics({
      uri: document.uri,
      version: document.version,
      diagnostics: await this.generate(document)
    });
  }
}

import { init } from "vscode-nls-i18n";

// init i18n
init(process.env.VSCODE_DENO_EXTENSION_PATH);

import { promises as fs } from "fs";

import {
  IPCMessageReader,
  IPCMessageWriter,
  createConnection,
  IConnection,
  TextDocuments,
  InitializeResult,
  Range,
  TextEdit,
  CompletionItem,
  CompletionItemKind,
  Position,
  TextDocumentSyncKind,
  CodeActionKind
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import * as ts from "typescript";

import { deno, FormatableLanguages } from "./deno";
import { Diagnostics } from "./diagnostics";
import { Bridge } from "./bridge";

const SERVER_NAME = "Deno Language Server";
process.title = SERVER_NAME;

// Create a connection for the server. The connection uses Node's IPC as a transport
const connection: IConnection = createConnection(
  new IPCMessageReader(process),
  new IPCMessageWriter(process)
);

// Create a simple text document manager. The text document manager
// supports full document sync only
const documents = new TextDocuments(TextDocument);

const bridge = new Bridge(connection);
const diagnostics = new Diagnostics(SERVER_NAME, connection, bridge, documents);

connection.onInitialize(
  (params): InitializeResult => {
    return {
      capabilities: {
        documentFormattingProvider: true,
        textDocumentSync: {
          openClose: true,
          change: TextDocumentSyncKind.Full
        },
        completionProvider: {
          triggerCharacters: ["http", "https"]
        },
        codeActionProvider: {
          codeActionKinds: [CodeActionKind.QuickFix]
        }
      }
    };
  }
);

connection.onInitialized(async params => {
  try {
    await deno.init();
    const currentDenoTypesContent = await deno.getTypes();
    const isExistDtsFile = await ts.sys.fileExists(deno.dtsFilepath);
    const fileOptions = { encoding: "utf8" };

    // if dst file not exist. then create a new one
    if (!isExistDtsFile) {
      await fs.writeFile(
        deno.dtsFilepath,
        currentDenoTypesContent,
        fileOptions
      );
    } else {
      const typesContent = await fs.readFile(deno.dtsFilepath, fileOptions);

      if (typesContent.toString() !== currentDenoTypesContent.toString()) {
        await fs.writeFile(
          deno.dtsFilepath,
          currentDenoTypesContent,
          fileOptions
        );
      }
    }
  } catch (err) {
    connection.sendNotification("error", err.message);
    return;
  }
  connection.sendNotification("init", {
    version: deno.version ? deno.version : undefined,
    executablePath: deno.executablePath,
    DENO_DIR: deno.DENO_DIR,
    dtsFilepath: deno.dtsFilepath
  });
  connection.console.log("server initialized.");
});

connection.onDocumentFormatting(async params => {
  const uri = params.textDocument.uri;
  const doc = documents.get(uri);

  if (!doc) {
    return;
  }

  const text = doc.getText();

  const workspaceFolder = await bridge.getWorkspace(uri);

  const cwd = workspaceFolder ? workspaceFolder.uri.fsPath : "./";

  connection.console.log(
    `Formatting '${uri.toString()}' at ${
      workspaceFolder ? workspaceFolder.uri.fsPath : ""
    }`
  );

  const formatted = await deno.format(
    text,
    doc.languageId as FormatableLanguages,
    {
      cwd
    }
  );

  const start = doc.positionAt(0);
  const end = doc.positionAt(text.length);

  const range = Range.create(start, end);

  return [TextEdit.replace(range, formatted)];
});

connection.onCompletion(async params => {
  const { position, partialResultToken, textDocument } = params;

  const doc = documents.get(textDocument.uri);

  if (!doc) {
    return [];
  }

  const currentLine = doc.getText(
    Range.create(Position.create(position.line, 0), position)
  );

  const IMPORT_REG = /import\s['"][a-zA-Z\._-]$/;
  const IMPORT_FROM_REG = /import\s(([^\s]*)|(\*\sas\s[^\s]*))\sfrom\s['"][a-zA-Z\._-]$/;
  const DYNAMIC_REG = /import\s*\(['"][a-zA-Z\._-]$/;

  const isImport =
    IMPORT_REG.test(currentLine) || // import "https://xxxx.xxxx"
    IMPORT_FROM_REG.test(currentLine) || // import xxxx from "https://xxxx.xxxx"
    DYNAMIC_REG.test(currentLine); // import("https://xxxx.xxxx")

  if (
    currentLine.length > 1000 || // if is a large file
    !isImport
  ) {
    return [];
  }

  const deps = await deno.getDependencies();

  const range = Range.create(
    Position.create(position.line, position.character - 5),
    position
  );

  const completes: CompletionItem[] = deps.map(dep => {
    return {
      label: dep.url,
      detail: dep.url,
      sortText: dep.url,
      documentation: dep.filepath.replace(deno.DENO_DIR, "$DENO_DIR"),
      kind: CompletionItemKind.File,
      insertText: dep.url,
      cancel: partialResultToken,
      range: range
    } as CompletionItem;
  });

  return completes;
});

documents.onDidOpen(params => diagnostics.diagnosis(params.document));
documents.onDidChangeContent(params => diagnostics.diagnosis(params.document));

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();

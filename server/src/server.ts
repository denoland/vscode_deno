import { init } from "vscode-nls-i18n";

// init i18n
init(process.env.VSCODE_DENO_EXTENSION_PATH + "");

import { promises as fs } from "fs";

import {
  IPCMessageReader,
  IPCMessageWriter,
  createConnection,
  IConnection,
  TextDocuments,
  InitializeResult,
  TextDocumentSyncKind,
  CodeActionKind
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { deno } from "./deno";
import { Bridge } from "./bridge";
import { DependencyTree } from "./dependency_tree";
import { Diagnostics } from "./language/diagnostics";
import { Definition } from "./language/definition";
import { References } from "./language/references";
import { DocumentHighlight } from "./language/document_highlight";
import { DocumentFormatting } from "./language/document_formatting";
import { Hover } from "./language/hover";
import { Completion } from "./language/completion";
import { CodeLens } from "./language/code_lens";

import { getDenoDir, getDenoDts } from "../../core/deno";
import { pathExists } from "../../core/util";

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
new DependencyTree(connection, bridge);
new Diagnostics(SERVER_NAME, connection, bridge, documents);
new Definition(connection, documents);
new References(connection, documents);
new DocumentHighlight(connection, documents);
new DocumentFormatting(connection, documents, bridge);
new Hover(connection, documents);
new Completion(connection, documents);
new CodeLens(connection, documents);

connection.onInitialize(
  (): InitializeResult => {
    return {
      capabilities: {
        documentFormattingProvider: true,
        documentRangeFormattingProvider: true,
        textDocumentSync: {
          openClose: true,
          change: TextDocumentSyncKind.Full
        },
        completionProvider: {
          triggerCharacters: ["http", "https"]
        },
        codeActionProvider: {
          codeActionKinds: [CodeActionKind.QuickFix]
        },
        documentHighlightProvider: true,
        hoverProvider: true,
        referencesProvider: true,
        definitionProvider: true,
        codeLensProvider: {}
      }
    };
  }
);

connection.onInitialized(async () => {
  try {
    await deno.init();
    const currentDenoTypesContent = await deno.getTypes();
    const denoDtsFile = getDenoDts();
    const isExistDtsFile = await pathExists(denoDtsFile);

    // if dst file not exist. then create a new one
    if (!isExistDtsFile) {
      await fs.writeFile(denoDtsFile, currentDenoTypesContent, { mode: 0o444 });
    } else {
      // set it to writable
      await fs.chmod(denoDtsFile, 0o666);

      const typesContent = await fs.readFile(denoDtsFile, { encoding: "utf8" });

      if (typesContent.toString() !== currentDenoTypesContent.toString()) {
        await fs.writeFile(denoDtsFile, currentDenoTypesContent, {
          mode: 0o444
        });

        // set to readonly
        await fs.chmod(denoDtsFile, 0o444);
      }
    }
  } catch (err) {
    connection.sendNotification("error", err.message);
    return;
  }
  connection.sendNotification("init", {
    version: deno.version ? deno.version : undefined,
    executablePath: deno.executablePath,
    DENO_DIR: getDenoDir(),
    dtsFilepath: getDenoDts()
  });
  connection.console.log("server initialized.");
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();

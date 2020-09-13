import { promises as fs } from "fs";

import {
  IPCMessageReader,
  IPCMessageWriter,
  createConnection,
  IConnection,
  TextDocuments,
  InitializeResult,
  TextDocumentSyncKind,
  CodeActionKind,
  ExecuteCommandParams,
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
import {
  ImportCompletionEnhanced,
  CACHE_STATE,
} from "./language/import_completion_enhanced";

import { getDenoDir, getDenoDts } from "../../core/deno";
import { pathExists } from "../../core/util";
import { Notification } from "../../core/const";

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
const import_enhanced = new ImportCompletionEnhanced(connection, documents);
new DependencyTree(connection, bridge);
new Diagnostics(SERVER_NAME, connection, bridge, documents);
new Definition(connection, documents);
new References(connection, documents);
new DocumentHighlight(connection, documents);
new DocumentFormatting(connection, documents, bridge);
new Hover(connection, documents);
new Completion(connection, documents, import_enhanced);
new CodeLens(connection, documents);

connection.onInitialize(
  (): InitializeResult => {
    return {
      capabilities: {
        documentFormattingProvider: true,
        documentRangeFormattingProvider: true,
        textDocumentSync: {
          openClose: true,
          change: TextDocumentSyncKind.Full,
        },
        completionProvider: {
          triggerCharacters: ["http", "https", "@", '"', "'", "/"],
        },
        codeActionProvider: {
          codeActionKinds: [CodeActionKind.QuickFix],
        },
        documentHighlightProvider: true,
        hoverProvider: true,
        referencesProvider: true,
        definitionProvider: true,
        codeLensProvider: {},
        executeCommandProvider: {
          commands: ["deno._clear_import_enhancement_cache"],
        },
      },
    };
  }
);

async function ensureDenoDts(unstable: boolean) {
  const currentDenoTypesContent = await deno.getTypes(unstable);
  const denoDtsFile = getDenoDts(unstable);
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
        mode: 0o444,
      });

      // set to readonly
      await fs.chmod(denoDtsFile, 0o444);
    }
  }
}

connection.onInitialized(async () => {
  try {
    await deno.init();
    await Promise.all([ensureDenoDts(false), ensureDenoDts(true)]);
  } catch (err) {
    connection.sendNotification(Notification.error, err.message);
    return;
  }
  connection.sendNotification(Notification.init, {
    version: deno.version ? deno.version : undefined,
    executablePath: deno.executablePath,
    DENO_DIR: getDenoDir(),
  });
  connection.onExecuteCommand(async (params: ExecuteCommandParams) => {
    if (params.command === "deno._clear_import_enhancement_cache") {
      import_enhanced
        .clearCache()
        .then(() => connection.window.showInformationMessage("Clear success!"))
        .catch(() => connection.window.showErrorMessage("Clear failed!"));
    }
  });
  import_enhanced
    .cacheModList()
    .then((it) => {
      if (it === CACHE_STATE.CACHE_SUCCESS) {
        connection.window.showInformationMessage(
          "deno.land/x module list cached successfully!"
        );
      }
    })
    .catch(() =>
      connection.window.showErrorMessage(
        "deno.land/x module list failed to cache!"
      )
    );
  connection.console.log("server initialized.");
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();

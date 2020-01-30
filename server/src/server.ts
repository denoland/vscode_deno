import * as path from "path";
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
  Position
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { deno, FormatableLanguages } from "./deno";
import { isFilepathExist } from "./utils";

const configurationNamespace = "deno";

process.title = "Deno Language Server";

// The example settings
interface ISettings {
  enable: boolean;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: ISettings = { enable: true };
let globalSettings: ISettings = defaultSettings;

// Create a connection for the server. The connection uses Node's IPC as a transport
const connection: IConnection = createConnection(
  new IPCMessageReader(process),
  new IPCMessageWriter(process)
);

// Create a simple text document manager. The text document manager
// supports full document sync only
const documents = new TextDocuments(TextDocument);

connection.onInitialize(
  (): InitializeResult => {
    return {
      serverInfo: {
        name: process.title
      },
      capabilities: {
        documentFormattingProvider: true,
        completionProvider: {
          triggerCharacters: ["http", "https"],
          resolveProvider: true
        }
      }
    };
  }
);

function getDenoDtsFilepath(): string {
  return path.join(deno.DENO_DIR, "lib.deno_runtime.d.ts");
}

connection.onInitialized(async () => {
  try {
    await deno.init();
    const currentDenoTypesContent = await deno.getTypes();
    const typeFilepath = getDenoDtsFilepath();
    const isExistDtsFile = await isFilepathExist(typeFilepath);

    // if dst file not exist. then create a new one
    if (!isExistDtsFile) {
      await fs.writeFile(typeFilepath, currentDenoTypesContent, {
        encoding: "utf8"
      });
    } else {
      const typesContent = await fs.readFile(typeFilepath, {
        encoding: "utf8"
      });

      if (typesContent.toString() !== currentDenoTypesContent.toString()) {
        await fs.writeFile(typeFilepath, currentDenoTypesContent, {
          encoding: "utf8"
        });
      }
    }
  } catch (err) {
    connection.sendNotification("error", err.message);
    return;
  }
  connection.sendNotification("init", {
    version: deno.version ? deno.version.deno : undefined,
    executablePath: deno.executablePath,
    DENO_DIR: deno.DENO_DIR
  });
  connection.console.log("server start");
});

connection.onDocumentFormatting(async params => {
  if (!globalSettings.enable) {
    return [];
  }
  const uri = params.textDocument.uri;
  const doc = documents.get(uri);

  if (!doc) {
    return;
  }

  const text = doc.getText();

  const formatted = await deno.format(
    text,
    doc.languageId as FormatableLanguages,
    {
      cwd: "./"
    }
  );

  const start = doc.positionAt(0);
  const end = doc.positionAt(text.length);

  const range = Range.create(start, end);

  return [TextEdit.replace(range, formatted)];
});

interface Deps {
  url: string;
  filepath: string;
}

async function getDepsFile(
  rootDir = path.join(deno.DENO_DIR, "deps"),
  deps: Deps[] = []
): Promise<Deps[]> {
  const files = await fs.readdir(rootDir);

  const promises = files.map(filename => {
    const filepath = path.join(rootDir, filename);
    return fs.stat(filepath).then(stat => {
      if (stat.isDirectory()) {
        return getDepsFile(filepath, deps);
      } else if (
        stat.isFile() &&
        /\.tsx?$/.test(filepath) &&
        !filepath.endsWith(".d.ts")
      ) {
        const url = filepath
          .replace(path.join(deno.DENO_DIR, "deps"), "")
          .replace(/^(\/|\\\\)/, "")
          .replace(/http(\/|\\\\)/, "http://")
          .replace(/https(\/|\\\\)/, "https://");

        deps.push({
          url: url,
          filepath: filepath
        });
      }
    });
  });

  await Promise.all(promises);

  return deps;
}

connection.onCompletionResolve(
  (item: CompletionItem): CompletionItem => {
    return item;
  }
);

connection.onCompletion(async params => {
  if (!globalSettings.enable) {
    return [];
  }
  const { position, partialResultToken } = params;
  const deps = await getDepsFile();

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

connection.onDidChangeConfiguration(change => {
  const denoConfig = (change.settings[configurationNamespace] ||
    defaultSettings) as ISettings;

  console.log(`detect config change ${JSON.stringify(denoConfig)}`);

  globalSettings = { ...globalSettings, ...denoConfig };
});

// connection.onDidChangeTextDocument(params => {
//   // TODO: send diagnostics
//   // connection.sendDiagnostics()
// });

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();

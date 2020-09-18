import {
  IConnection,
  Range,
  TextDocuments,
  CompletionItem,
  CompletionItemKind,
  Position,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { getDenoDir } from "../../../core/deno";
import { getAllDenoCachedDeps, Deps } from "../../../core/deno_deps";
import { Cache } from "../../../core/cache";

import { ImportIntelliSense } from "./import_intellisense";

// Cache for 30 second or 30 references
const cache = Cache.create<Deps[]>(1000 * 30, 30);

getAllDenoCachedDeps()
  .then((deps) => {
    cache.set(deps);
  })
  .catch(() => {
    // do nothing
  });

export class Completion {
  constructor(
    connection: IConnection,
    documents: TextDocuments<TextDocument>,
    importIntellisense: ImportIntelliSense
  ) {
    connection.onCompletion(async (params) => {
      const { position, partialResultToken, textDocument } = params;

      const doc = documents.get(textDocument.uri);

      if (!doc) {
        return [];
      }

      const currentLine = doc.getText(
        Range.create(Position.create(position.line, 0), position)
      );

      const IMPORT_REG = /import\s['"][a-zA-Z._-]$/;
      const IMPORT_FROM_REG = /import\s(([^\s]*)|(\*\sas\s[^\s]*))\sfrom\s['"][a-zA-Z._-]?$/;
      const DYNAMIC_REG = /import\s*\(['"][a-zA-Z._-]['"]?$/;

      const isImport =
        IMPORT_REG.test(currentLine) || // import "https://xxxx.xxxx"
        IMPORT_FROM_REG.test(currentLine) || // import xxxx from "https://xxxx.xxxx"
        DYNAMIC_REG.test(currentLine); // import("https://xxxx.xxxx")

      if (
        currentLine.length > 1000 || // if is a large file
        !isImport
      ) {
        return importIntellisense.complete(params);
      }

      connection.console.log("pos: " + position.line);

      let deps = cache.get();

      if (!deps) {
        deps = await getAllDenoCachedDeps();
        cache.set(deps);
      }

      const range = Range.create(
        Position.create(position.line, position.character),
        position
      );

      // if (/.*?import[^'"]*?'$/.test(currentLine)) {
      //   deps = deps.map((it) => {
      //     const url = new URL(it.url);
      //     return {
      //       filepath: it.filepath,
      //       url: url.hostname === "deno.land" ? `${url.origin}` : it.url,
      //     } as Deps;
      //   });
      //   const dedup_arr: string[] = [];
      //   deps = deps.filter((it) => {
      //     if (dedup_arr.includes(it.url)) {
      //       return false;
      //     } else {
      //       dedup_arr.push(it.url);
      //       return true;
      //     }
      //   });
      // }

      const completes: CompletionItem[] = deps.map((dep) => {
        return {
          label: dep.url,
          detail: dep.url,
          sortText: dep.url,
          documentation: dep.filepath.replace(getDenoDir(), "$DENO_DIR"),
          kind: CompletionItemKind.File,
          insertText: dep.url,
          cancel: partialResultToken,
          range: range,
        } as CompletionItem;
      });

      completes.push(...(await importIntellisense.complete(params)).items);

      return completes;
    });
  }
}

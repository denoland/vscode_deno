import {
  IConnection,
  Range,
  TextDocuments,
  Position,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { URI } from "vscode-uri";

import { CacheModule } from "../../../core/deno_cache";
import { isInDeno } from "../../../core/deno";

export class CodeLens {
  constructor(connection: IConnection, documents: TextDocuments<TextDocument>) {
    connection.onCodeLens((params) => {
      const { textDocument } = params;

      const document = documents.get(textDocument.uri);

      if (!document) {
        return [];
      }

      const filepath = URI.parse(document.uri).fsPath;

      if (!isInDeno(filepath)) {
        return [];
      }

      const cache = CacheModule.create(filepath);

      if (!cache) {
        return;
      }

      return [
        {
          range: Range.create(Position.create(0, 0), Position.create(0, 0)),
          command: {
            title: `Deno cached module \`${cache.url.href}\``,
            command: "deno._copy_text",
            arguments: [cache.url.href],
          },
        },
      ];
    });
  }
}

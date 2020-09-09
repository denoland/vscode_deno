import {
  IConnection,
  Range,
  TextDocuments,
  Location,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { URI } from "vscode-uri";

import { getDenoTypesHintsFromDocument } from "../deno_types";
import { ModuleResolver } from "../../../core/module_resolver";

import Plugable from "../Plugable";

export class Definition implements Plugable {
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  constructor(
    private enabled: boolean,
    connection: IConnection,
    documents: TextDocuments<TextDocument>
  ) {
    connection.onDefinition(async (params) => {
      if (!this.enabled) return;
      const { textDocument, position } = params;
      const document = documents.get(textDocument.uri);

      if (!document) {
        return;
      }

      const uri = URI.parse(document.uri);

      const resolver = ModuleResolver.create(uri.fsPath);

      const locations: Location[] = [];

      const denoTypesComments = getDenoTypesHintsFromDocument(document);

      for (const typeComment of denoTypesComments) {
        const start = typeComment.contentRange.start;
        const end = typeComment.contentRange.end;
        if (
          position.line >= start.line &&
          position.line <= end.line &&
          position.character >= start.character &&
          position.character <= end.character
        ) {
          const [typeModule] = resolver.resolveModules([typeComment.text]);
          if (typeModule) {
            locations.push(
              Location.create(
                URI.file(typeModule.filepath).toString(),
                Range.create(0, 0, 0, 0)
              )
            );
          }
        }
      }

      return locations;
    });
  }
}

import {
  IConnection,
  TextDocuments,
  Range,
  CompletionList,
  CompletionParams,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { Bridge } from "../bridge";
import {
  getWellKnown,
  parseURLFromImportStatement,
} from "../../../core/import_intellisense";

export class ImportIntelliSense {
  constructor(
    private connection: IConnection,
    private bridge: Bridge,
    private documents: TextDocuments<TextDocument>
  ) {}

  async complete(param: CompletionParams): Promise<CompletionList> {
    const { textDocument, position } = param;

    const config = await this.bridge.getWorkspaceConfig(textDocument.uri);

    // Get the document, and bail if this document does not exist.
    const document = this.documents.get(textDocument.uri);
    if (document === undefined) return CompletionList.create();

    const currentLineText = document.getText(
      Range.create(position.line, 0, position.line + 1, 0)
    );

    // Get URL from import statement on this line if there is one.
    // Bail if no import statement / remote URL is found.
    const url = parseURLFromImportStatement(currentLineText);
    if (!url) return CompletionList.create();

    const enabledForThisOrigin = config.import_intellisense_origins[url.origin];
    switch (enabledForThisOrigin) {
      case true:
        return this.getCompletionsForURL(url);
      case false:
        this.connection.console.log("Origin disabled: " + url.origin);
        return CompletionList.create();
      default: {
        const origin = url.origin;
        this.connection.console.log("New origin: " + origin);
        getWellKnown(origin)
          .then((wellknown) => {
            this.connection.console.log(
              `Import autocomplete for ${origin} available at vesion ${wellknown.version}`
            );
            this.bridge.promptEnableImportIntelliSense(origin);
          })
          .catch((err) => {
            this.connection.console.log(
              `Import autocomplete for ${origin} not available: ${err}`
            );
          });
        return CompletionList.create();
      }
    }
  }

  async getCompletionsForURL(url: URL): Promise<CompletionList> {
    this.connection.console.log("Autocompleting " + url);
    return CompletionList.create();
  }
}

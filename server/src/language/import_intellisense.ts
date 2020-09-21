import {
  IConnection,
  TextDocuments,
  Range,
  CompletionList,
  CompletionParams,
  CompletionItem,
  Position,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { Bridge } from "../bridge";
import {
  WellKnown,
  getCompletionsForURL,
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
    const parsed = parseURLFromImportStatement(currentLineText);
    if (!parsed) return CompletionList.create();
    const [url, urlIndex] = parsed;

    const enabledForThisOrigin = config.import_intellisense_origins[url.origin];
    switch (enabledForThisOrigin) {
      case true: {
        this.connection.console.log("Autocompleting " + url);
        try {
          const wellknown = await getWellKnown(url.origin);
          return this.getCompletionListForURL(
            wellknown,
            url,
            urlIndex,
            position
          );
        } catch (err) {
          console.error(err);
          return CompletionList.create();
        }
      }
      case false:
        this.connection.console.log("Origin disabled: " + url.origin);
        return CompletionList.create();
      default: {
        const origin = url.origin;
        if (config.import_intellisense_autodiscovery) {
          this.connection.console.log(`Trying autodiscovery for ${origin}`);
          getWellKnown(origin)
            .then((wellknown) => {
              this.connection.console.log(
                `Auto-discovery for ${origin} worked. Origin capable at vesion ${wellknown.version}.`
              );
              this.bridge.promptEnableImportIntelliSense(origin);
            })
            .catch((err) => {
              this.connection.console.log(
                `Auto-discovery for ${origin} failed: ${err}`
              );
            });
        } else {
          this.connection.console.log(
            `Autodiscovery disabled so it won't be tried for ${origin}`
          );
        }
        return CompletionList.create();
      }
    }
  }

  async getCompletionListForURL(
    wellknown: WellKnown,
    url: URL,
    urlIndex: number,
    cursor: Position
  ): Promise<CompletionList> {
    const completions = await getCompletionsForURL(
      wellknown,
      url,
      urlIndex,
      cursor.character
    );
    return CompletionList.create(
      completions.map((v, i) => {
        const c = CompletionItem.create(v);
        c.filterText = v;
        c.sortText = `a${i.toString().padStart(10, "0")}`;
        return c;
      })
    );
  }
}

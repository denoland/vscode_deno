import {
  IConnection,
  TextDocuments,
  Range,
  CompletionList,
  CompletionParams,
  Position,
  CompletionItem,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { Bridge } from "../bridge";
import {
  fetchCompletionList,
  getWellKnown,
  parseURLFromImportStatement,
  WellKnown,
} from "../../../core/import_intellisense";
import { parse, regexpToFunction, Token, tokensToRegexp } from "path-to-regexp";

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
      case true:
        return this.getCompletionsForURL(url, urlIndex, position);
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

  async getCompletionsForURL(
    url: URL,
    urlIndex: number,
    cursor: Position
  ): Promise<CompletionList> {
    this.connection.console.log("Autocompleting " + url);
    let wellknown: WellKnown;
    try {
      wellknown = await getWellKnown(url.origin);
    } catch (err) {
      console.error(err);
      return CompletionList.create();
    }

    const positionInPath = cursor.character - urlIndex - url.origin.length;
    if (positionInPath < 0) return CompletionList.create();

    const pathname = url.pathname;

    const completions = new Set<string>();

    for (const registry of wellknown.registries) {
      const tokens = parse(registry.schema);
      for (let i = tokens.length; i >= 0; i--) {
        const keys = [];
        const matcher = regexpToFunction(
          tokensToRegexp(tokens.slice(0, i), keys),
          keys
        );
        const matched = matcher(pathname);
        if (!matched) continue;

        const values = Object.fromEntries(
          Object.entries(matched.params).map<[string, string]>(
            ([k, v]: [string, string[]]) => {
              if (Array.isArray(v)) {
                return [k, v.join("/")];
              } else {
                return [k, v];
              }
            }
          )
        );

        const completor = this.findCompletor(
          url.origin,
          urlIndex,
          cursor,
          tokens.slice(0, i + 1),
          values
        );

        if (!completor) break;
        const [type, value] = completor;
        switch (type) {
          case "literal":
            if (value.startsWith("/")) {
              completions.add(value.slice(1));
            } else {
              completions.add(value);
            }
            break;
          case "variable":
            try {
              const url = registry.variables.find((v) => v.key === value)?.url;
              if (!url) break;
              const list = await fetchCompletionList(url, values);
              for (const v of list) {
                completions.add(v);
              }
            } catch (err) {
              console.error(err);
            }

            break;
        }
        break;
      }
    }

    const list = CompletionList.create(
      [...completions].map((v, i) => {
        const c = CompletionItem.create(v);
        c.filterText = v;
        c.sortText = `a${i.toString().padStart(10, "0")}`;
        return c;
      })
    );
    return list;
  }

  findCompletor(
    origin: string,
    urlIndex: number,
    cursor: Position,
    tokens: Token[],
    values: Record<string, string>
  ): ["literal" | "variable", string] | undefined {
    const positionInURL = cursor.character - urlIndex;
    let totalLength = origin.length;
    for (const token of tokens) {
      if (typeof token === "string") {
        totalLength += token.length;
        if (positionInURL < totalLength) {
          return ["literal", token];
        }
      } else {
        totalLength += token.prefix.length;
        if (positionInURL < totalLength) {
          return undefined;
        }
        const value = values[token.name] ?? "";
        if (Array.isArray(value)) {
          totalLength += value.join("/").length;
        } else {
          totalLength += value.length;
        }
        if (positionInURL <= totalLength) {
          return ["variable", token.name.toString()];
        }
        totalLength += token.suffix.length;
        if (positionInURL <= totalLength) {
          return ["literal", token.suffix];
        }
      }
    }
  }
}

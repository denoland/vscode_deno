import {
  CompletionItemProvider,
  TextDocument,
  Position,
  CancellationToken,
  CompletionContext,
  CompletionItem,
  Disposable,
  CompletionItemKind,
} from "vscode";

import {
  listVersionsOfMod,
  modTreeOf,
  parseImportStatement,
} from "./import_utils";

export class ImportEnhancementCompletionProvider
  implements CompletionItemProvider, Disposable {
  async provideCompletionItems(
    document: TextDocument,
    position: Position,
    _token: CancellationToken,
    _context: CompletionContext
  ): Promise<CompletionItem[] | undefined> {
    const line_text = document.lineAt(position).text;

    if (/import.+?from\W+['"].*?['"]/.test(line_text)) {
      // We're at import statement line
      const imp_info = parseImportStatement(line_text);
      if (
        imp_info?.domain !== "deno.land" ||
        imp_info.module === undefined ||
        imp_info.module.length === 0
      ) {
        return undefined;
      }
      // We'll handle the completion only if the domain is `deno.land` and mod name is not empty
      const current_char = line_text[position.character - 1];
      if (current_char === "@") {
        // Version completion
        const vers = await listVersionsOfMod(imp_info.module);
        return (
          vers.versions
            /*
            .sort((a, b) => {
                const arr_a = a.split('.').map(it => Number.parseInt(it));
                const arr_b = b.split('.').map(it => Number.parseInt(it));
                for(let i in arr_a){
                    let diff = arr_b[i] - arr_a[i];
                    if(diff !== 0){
                        return diff;
                    }
                }
                return 0;
            })
            */
            .map((it) => new CompletionItem(it, CompletionItemKind.Value))
        );
      }

      const result = await modTreeOf(imp_info.module, imp_info.version);
      const r = result.directory_listing
        .filter((it) => it.path.startsWith(imp_info.path))
        .map((it) => ({
          path: it.path.replace(imp_info.path, ""),
          size: it.size,
          type: it.type,
        }))
        .filter(
          (it) =>
            //  exclude tests
            !(it.path.endsWith("_test.ts") || it.path.endsWith("_test.js")) &&
            //  include only js and ts
            (it.path.endsWith(".ts") || it.path.endsWith(".js"))
        )
        .sort((a, b) => a.path.length - b.path.length)
        .map(
          (it) =>
            new CompletionItem(
              it.path,
              it.type === "dir"
                ? CompletionItemKind.Folder
                : CompletionItemKind.File
            )
        );
      return r;
    }
  }

  dispose() {
    /* eslint-disable */
  }
}

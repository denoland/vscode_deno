import {
  CompletionItemProvider,
  TextDocument,
  Position,
  CompletionItem,
  Disposable,
  CompletionItemKind,
  CompletionList,
  DocumentSelector,
  languages,
  ExtensionContext,
  Range,
  Command,
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
    position: Position
    // _token: CancellationToken,
    // _context: CompletionContext
  ): Promise<CompletionItem[] | CompletionList | undefined> {
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

        const result = vers.versions
          .sort((a, b) => {
            const arr_a = a.split(".").map((it) => Number.parseInt(it));
            const arr_b = b.split(".").map((it) => Number.parseInt(it));
            for (const i in arr_a) {
              const diff = arr_b[i] - arr_a[i];
              if (diff !== 0) {
                return diff;
              }
            }
            return 0;
          })
          .map((it, i) => {
            // let latest version on top
            const ci = new CompletionItem(it, CompletionItemKind.Value);
            ci.sortText = `a${String.fromCharCode(i) + 1}`;
            ci.filterText = "a";
            // https://github.com/microsoft/vscode-extension-samples/blob/bb4a0c3a5dd9460a5cd64290b4d5c4f6bd79bdc4/completions-sample/src/extension.ts#L37
            ci.command = <Command>{
              command: "editor.action.triggerSuggest",
              title: "Re-trigger completions...",
            };
            return ci;
          });
        return new CompletionList(result);
      }

      const result = await modTreeOf(imp_info.module, imp_info.version);
      const arr_path = imp_info.path.split("/");
      const path = arr_path.slice(0, arr_path.length - 1).join("/") + "/";

      const r = result.directory_listing
        .filter((it) => it.path.startsWith(path))
        .map((it) => ({
          path:
            path.length > 1 ? it.path.replace(path, "") : it.path.substring(1),
          size: it.size,
          type: it.type,
        }))
        .filter((it) => it.path.split("/").length < 2)
        .filter(
          (it) =>
            //  exclude tests
            !(it.path.endsWith("_test.ts") || it.path.endsWith("_test.js")) &&
            //  include only js and ts
            (it.path.endsWith(".ts") ||
              it.path.endsWith(".js") ||
              it.type !== "file") &&
            // exclude privates
            !it.path.startsWith("_") &&
            // exclude hidden file/folder
            !it.path.startsWith(".") &&
            // exclude testdata dir
            (it.path !== "testdata" || it.type !== "dir") &&
            it.path.length !== 0
        )
        // .sort((a, b) => a.path.length - b.path.length)
        .map((it) => {
          const r = new CompletionItem(
            it.path,
            it.type === "dir"
              ? CompletionItemKind.Folder
              : CompletionItemKind.File
          );
          r.sortText = it.type === "dir" ? "a" : "b";
          r.insertText = it.type === "dir" ? it.path + "/" : it.path;
          r.range = new Range(
            position.line,
            line_text.substring(0, position.character).lastIndexOf("/") + 1,
            position.line,
            position.character
          );
          if (it.type === "dir") {
            // https://github.com/microsoft/vscode-extension-samples/blob/bb4a0c3a5dd9460a5cd64290b4d5c4f6bd79bdc4/completions-sample/src/extension.ts#L37
            r.command = <Command>{
              command: "editor.action.triggerSuggest",
              title: "Re-trigger completions...",
            };
          }
          return r;
        });
      return new CompletionList(r, false);
    }
  }

  activate(ctx: ExtensionContext): void {
    const document_selector = <DocumentSelector>[
      { language: "javascript" },
      { language: "typescript" },
    ];
    const trigger_word = ["@", "/"];
    const import_enhance = new ImportEnhancementCompletionProvider();
    ctx.subscriptions.push(
      languages.registerCompletionItemProvider(
        document_selector,
        import_enhance,
        ...trigger_word
      )
    );
  }

  dispose(): void {
    /* eslint-disable */
  }
}

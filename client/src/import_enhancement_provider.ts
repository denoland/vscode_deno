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
  window,
  ProgressLocation,
} from "vscode";

import Semver from "semver";

import VC = require("vscode-cache");

import {
  listVersionsOfMod,
  modTreeOf,
  parseImportStatement,
  searchX,
  fetchModList,
  ModuleInfo,
} from "./import_utils";

export enum CACHE_STATE {
  ALREADY_CACHED,
  CACHE_SUCCESS,
}

export class ImportEnhancementCompletionProvider
  implements CompletionItemProvider, Disposable {
  vc?: VC;
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
      if (imp_info?.domain !== "deno.land") {
        return undefined;
      }
      // We'll handle the completion only if the domain is `deno.land` and mod name is not empty
      const at_index = line_text.indexOf("@");
      if (
        /.*?deno.land\/(x\/)?\w+@[\w.-]*$/.test(
          line_text.substring(0, position.character)
        ) &&
        position.character > at_index
      ) {
        // Version completion
        const vers = await listVersionsOfMod(imp_info.module);

        const result = vers.versions
          .sort((a, b) => {
            const av = Semver.clean(a);
            const bv = Semver.clean(b);
            if (
              av === null ||
              bv === null ||
              !Semver.valid(av) ||
              !Semver.valid(bv)
            ) {
              return 0;
            }
            return Semver.gt(av, bv) ? -1 : 1;
          })
          .map((it, i) => {
            // let latest version on top
            const ci = new CompletionItem(it, CompletionItemKind.Value);
            ci.sortText = `a${String.fromCharCode(i) + 1}`;
            ci.filterText = it;
            ci.range = new Range(
              position.line,
              at_index + 1,
              position.line,
              position.character
            );
            return ci;
          });
        return new CompletionList(result);
      }

      if (
        /.*?deno\.land\/x\/\w*$/.test(
          line_text.substring(line_text.indexOf("'") + 1, position.character)
        )
      ) {
        // x module name completion
        if (this.vc !== undefined) {
          const result: { name: string; description: string }[] = await searchX(
            this.vc,
            imp_info.module
          );
          const r = result.map((it) => {
            const ci = new CompletionItem(it.name, CompletionItemKind.Module);
            ci.detail = it.description;
            ci.sortText = String.fromCharCode(1);
            ci.filterText = it.name;
            return ci;
          });
          return r;
        } else {
          return [];
        }
      }

      if (
        !/.*?deno\.land\/(x\/)?\w+(@[\w.-]*)?\//.test(
          line_text.substring(0, position.character)
        )
      ) {
        return [];
      }

      const result = await modTreeOf(
        this.vc,
        imp_info.module,
        imp_info.version
      );
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
              it.path.endsWith(".tsx") ||
              it.path.endsWith(".jsx") ||
              it.path.endsWith(".mjs") ||
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

  async clearCache(): Promise<void> {
    await this.vc?.flush();
  }

  async cacheModList(): Promise<CACHE_STATE> {
    return window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: "Fetching module list...",
      },
      async (progress) => {
        const mod_list_key = "mod_list";
        if (this.vc?.isExpired(mod_list_key) || !this.vc?.has(mod_list_key)) {
          this.vc?.forget(mod_list_key);
          progress.report({ increment: 0 });
          for await (const modules of fetchModList()) {
            if (this.vc?.has(mod_list_key)) {
              const list_in_cache = this.vc?.get(mod_list_key) as ModuleInfo[];
              list_in_cache.push(...modules.data);
              await this.vc?.put(
                mod_list_key,
                list_in_cache,
                60 * 60 * 24 * 7 /* expiration in a week */
              );
            } else {
              this.vc?.put(
                mod_list_key,
                modules.data,
                60 * 60 * 24 * 7 /* expiration in a week */
              );
            }
            progress.report({
              increment: (1 / modules.total) * 100,
            });
          }
          return CACHE_STATE.CACHE_SUCCESS;
        }
        return CACHE_STATE.ALREADY_CACHED;
      }
    );
  }

  activate(ctx: ExtensionContext): void {
    this.vc = new VC(ctx, "import-enhanced");

    const document_selector = <DocumentSelector>[
      { language: "javascript" },
      { language: "typescript" },
      { language: "javascriptreact" },
      { language: "typescriptreact" },
    ];
    const trigger_word = ["@", "/"];
    ctx.subscriptions.push(
      languages.registerCompletionItemProvider(
        document_selector,
        this,
        ...trigger_word
      )
    );
  }

  dispose(): void {
    /* eslint-disable */
  }
}

import {
  IConnection,
  TextDocument,
  TextDocuments,
  Range,
  CompletionItem,
  CompletionList,
  CompletionItemKind,
  CompletionParams,
} from "vscode-languageserver";

import semver from "semver";

import {
  parseImportStatement,
  //   listVersionsOfMod,
  searchX,
  modTreeOf,
  fetchModList,
  ModList,
  IMP_REG,
  VERSION_REG,
  listVersionsOfMod,
  ModListCache,
  ModTreeCache,
  ModTreeCacheItem,
} from "../../../core/import_enhanced";

import { PermCache, TRANSACTION_STATE } from "../../../core/permcache";

export enum CACHE_STATE {
  ALREADY_CACHED = 1,
  CACHE_SUCCESS = 0,
  UNKNOWN_ERROR = -1,
}

export class ImportCompletionEnhanced {
  mod_tree_cache?: ModTreeCache;
  mod_list_cache?: ModListCache;

  private connection: IConnection;
  private documents: TextDocuments<TextDocument>;

  constructor(connection: IConnection, documents: TextDocuments<TextDocument>) {
    this.connection = connection;
    this.documents = documents;
  }

  async please(param: CompletionParams): Promise<CompletionList> {
    if (!this.mod_list_cache) {
      this.mod_list_cache = await PermCache.create<ModList>(
        "mod_list",
        60 * 60 * 24 /* expiring in a day */
      );
    }
    if (!this.mod_tree_cache) {
      this.mod_tree_cache = await PermCache.create<ModTreeCacheItem>(
        "mod_tree"
      );
    }
    const { textDocument, position } = param;
    const doc = this.documents.get(textDocument.uri);
    if (typeof doc !== "undefined") {
      const current_line_text = doc.getText(
        Range.create(position.line, 0, position.line, position.character)
      );

      if (IMP_REG.test(current_line_text)) {
        // We're at import statement line
        const imp_info = parseImportStatement(current_line_text);
        if (imp_info?.domain !== "deno.land") {
          return CompletionList.create();
        }

        const index_of_at_symbol = current_line_text.indexOf("@");
        if (index_of_at_symbol !== -1) {
          const maybe_version = current_line_text.substring(
            index_of_at_symbol + 1
          );
          if (
            (VERSION_REG.test(maybe_version) || maybe_version.length === 0) &&
            position.character > index_of_at_symbol
          ) {
            const vers = await listVersionsOfMod(imp_info.module);
            const result = vers.versions
              .sort((a, b) => {
                const av = semver.clean(a);
                const bv = semver.clean(b);
                if (
                  av === null ||
                  bv === null ||
                  !semver.valid(av) ||
                  !semver.valid(bv)
                ) {
                  return 0;
                }
                return semver.gt(av, bv) ? -1 : 1;
              })
              .map((it, i) => {
                const ci = CompletionItem.create(it);
                ci.sortText = `a${String.fromCharCode(i) + 1}`;
                ci.filterText = it;
                ci.kind = CompletionItemKind.Value;
                return ci;
              });
            return CompletionList.create(result);
          }
        }

        if (/.*deno.land\/$/.test(current_line_text)) {
          // x or std
          return CompletionList.create([
            {
              label: "std",
              insertText: "std",
              kind: CompletionItemKind.Module,
            },
            { label: "x", insertText: "x/", kind: CompletionItemKind.Module },
          ]);
        }

        if (/.*deno.land\/x\/([\w-_]+)?$/.test(current_line_text)) {
          // x modules
          if (this.mod_list_cache !== undefined) {
            const result = await searchX(this.mod_list_cache, imp_info.module);
            const r = result.map((it) => {
              const ci = CompletionItem.create(it.name);
              ci.kind = CompletionItemKind.Module;
              ci.detail = it.description;
              ci.insertText = `${it.name}@`;
              ci.sortText = String.fromCharCode(1);
              ci.filterText = it.name;
              ci.command = {
                command: "editor.action.triggerSuggest",
                title: "Re-trigger completions...",
              };
              return ci;
            });
            return CompletionList.create(r);
          } else {
            return CompletionList.create();
          }
        }

        if (/.*deno.land(\/x)?\/.+?(@.+)?\//.test(current_line_text)) {
          // modules tree completion
          const result = await modTreeOf(
            imp_info.module,
            imp_info.version,
            this.mod_tree_cache
          );
          const arr_path = imp_info.path.split("/");
          const path = arr_path.slice(0, arr_path.length - 1).join("/") + "/";
          return CompletionList.create(
            result.directory_listing
              .filter((it) => it.path.startsWith(path))
              .map((it) => ({
                path:
                  path.length > 1
                    ? it.path.replace(path, "")
                    : it.path.substring(1),
                size: it.size,
                type: it.type,
              }))
              .filter((it) => it.path.split("/").length < 2)
              .filter(
                (it) =>
                  !(
                    it.path.endsWith("_test.ts") || it.path.endsWith("_test.js")
                  ) &&
                  (it.path.endsWith(".ts") ||
                    it.path.endsWith(".js") ||
                    it.path.endsWith(".tsx") ||
                    it.path.endsWith(".jsx") ||
                    it.path.endsWith(".mjs") ||
                    it.type !== "file") &&
                  !it.path.startsWith("_") &&
                  !it.path.startsWith(".") &&
                  (it.path !== "testdata" || it.type !== "dir") &&
                  it.path.length !== 0
              )
              .map((it) => {
                const r = CompletionItem.create(it.path);
                r.kind =
                  it.type === "dir"
                    ? CompletionItemKind.Folder
                    : CompletionItemKind.File;
                r.sortText = it.type === "dir" ? "a" : "b";
                r.insertText = it.type === "dir" ? it.path + "/" : it.path;
                if (it.type === "dir") {
                  r.command = {
                    command: "editor.action.triggerSuggest",
                    title: "Re-trigger completions...",
                  };
                }
                return r;
              })
          );
        }
        return CompletionList.create();
      }
    }
    return CompletionList.create();
  }

  async clearCache(): Promise<void> {
    await this.mod_list_cache?.destroy_cache();
    await this.mod_tree_cache?.destroy_cache();
  }

  async cacheModList(): Promise<CACHE_STATE> {
    const progress = await this.connection.window.createWorkDoneProgress();
    progress.begin("Fetching deno.land/x module list...", 0);
    if (!this.mod_list_cache) {
      this.mod_list_cache = await PermCache.create<ModList>(
        "mod_list",
        60 * 60 * 24 /* expiring in a day */
      );
    }

    if (
      this.mod_list_cache.expired() ||
      !this.mod_list_cache.get() ||
      this.mod_list_cache.get()?.length === 0
    ) {
      await this.mod_list_cache.destroy_cache();
      this.mod_list_cache = await PermCache.create<ModList>(
        "mod_list",
        60 * 60 * 24 /* expiring in a day */
      );
      this.mod_list_cache.set([]);
      progress.report(0);
      if (
        this.mod_list_cache.transaction_begin() === TRANSACTION_STATE.SUCCESS
      ) {
        for await (const modules of fetchModList()) {
          const list_in_cache = this.mod_list_cache.transaction_get()
            .data as ModList;
          list_in_cache.push(...modules.data);
          this.mod_list_cache.transaction_set(list_in_cache);
          progress.report((modules.current / modules.total) * 100);
        }
        if (
          (await this.mod_list_cache.transaction_commit()) ===
          TRANSACTION_STATE.SUCCESS
        ) {
          progress.done();
          return CACHE_STATE.CACHE_SUCCESS;
        }
      }
      progress.done();
      return CACHE_STATE.UNKNOWN_ERROR;
    }
    progress.done();
    return CACHE_STATE.ALREADY_CACHED;
  }
}

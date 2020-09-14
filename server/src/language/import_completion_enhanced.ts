import {
  IConnection,
  TextDocuments,
  Range,
  CompletionItem,
  CompletionList,
  CompletionItemKind,
  CompletionParams,
} from "vscode-languageserver";

import { TextDocument } from "vscode-languageserver-textdocument";

import semver from "semver";

import {
  IMP_REG,
  VERSION_REG,
  parseImportStatement,
  SupportedRegistry,
  SupportedRegistryType,
  getRegistries,
  getKeyOfVersionMap,
} from "../../../core/import_enhanced/index";

import { PermCache, TRANSACTION_STATE } from "../../../core/permcache";
import {
  ModInfoList,
  ModVersionMap,
} from "../../../core/import_enhanced/registry";

export enum CACHE_STATE {
  ALREADY_CACHED = 1,
  CACHE_SUCCESS = 0,
  UNKNOWN_ERROR = -1,
}

type ModListCacheContent = { [key in SupportedRegistryType]: ModInfoList };
type ModListCache = PermCache<ModListCacheContent>;
type ModTreeCacheContent = { [key in SupportedRegistryType]: ModVersionMap };
type ModTreeCache = PermCache<ModTreeCacheContent>;
//  ModInfoList, ModVersionMap
export class ImportCompletionEnhanced {
  mod_list_cache?: ModListCache;
  mod_tree_cache?: ModTreeCache;

  private connection: IConnection;
  private documents: TextDocuments<TextDocument>;

  constructor(connection: IConnection, documents: TextDocuments<TextDocument>) {
    this.connection = connection;
    this.documents = documents;
  }

  async please(param: CompletionParams): Promise<CompletionList> {
    if (!this.mod_list_cache) {
      this.mod_list_cache = await PermCache.create<ModListCacheContent>(
        "mod_list",
        60 * 60 * 24 /* expiring in a day */
      );
    }
    if (!this.mod_tree_cache) {
      this.mod_tree_cache = await PermCache.create<ModTreeCacheContent>(
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

        if (/.*:\/\/$/.test(current_line_text)) {
          // supported domain
          return CompletionList.create(
            SupportedRegistry.map((it) => ({
              label: it,
              insertText: `${it}/`,
              kind: CompletionItemKind.Text,
              command: {
                command: "editor.action.triggerSuggest",
                title: "Re-trigger completions...",
              },
            }))
          );
        }

        const imp_info = parseImportStatement(current_line_text);
        if (
          imp_info === undefined ||
          !SupportedRegistry.includes(imp_info.domain)
        ) {
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
            const vers = await getRegistries()[imp_info.domain].modVersionList(
              imp_info.module
            );
            if (vers.versions === undefined) {
              return CompletionList.create();
            }
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

        if (/.*:\/\/x.nest.land\/$/.test(current_line_text)) {
          const mods = await this.doSearchWithCache("x.nest.land");
          const result: ModInfoList = [
            { name: "std", description: "std module" },
            ...mods,
          ];
          return CompletionList.create(
            result.map(
              (it) =>
                ({
                  label: it.name,
                  detail: it.description ?? "",
                  kind: CompletionItemKind.Module,
                } as CompletionItem)
            )
          );
        }

        if (/.*:\/\/deno.land\/$/.test(current_line_text)) {
          return CompletionList.create([
            { label: "std", insertText: "std" },
            { label: "x", insertText: "x/" },
          ]);
        }

        if (/.*deno.land\/x\/([\w-_]+)?$/.test(current_line_text)) {
          // x modules
          if (this.mod_list_cache !== undefined) {
            const result = await this.doSearchWithCache(
              imp_info.domain as SupportedRegistryType
            );
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

        if (
          /.*deno.land(\/x)?\/.+?(@.+)?\//.test(current_line_text) ||
          /.*x.nest.land\/.*@.*?\/$/.test(current_line_text)
        ) {
          // modules tree completion
          const result = await this.doModTreeWithCache(
            imp_info.domain as SupportedRegistryType,
            imp_info.module,
            [imp_info.version]
          );
          const arr_path = imp_info.path.split("/");
          const path = arr_path.slice(0, arr_path.length - 1).join("/") + "/";
          const ret =
            result[getKeyOfVersionMap(imp_info.module, imp_info.version)];
          return CompletionList.create(
            ret.contents
              .filter((it) => it.value.startsWith(path))
              .map((it) => ({
                path:
                  path.length > 1
                    ? it.value.replace(path, "")
                    : it.value.substring(1),
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
                  (it.path !== "testdata" || it.type !== "folder") &&
                  it.path.length !== 0
              )
              .map((it) => {
                const r = CompletionItem.create(it.path);
                r.kind =
                  it.type === "folder"
                    ? CompletionItemKind.Folder
                    : CompletionItemKind.File;
                r.sortText = it.type === "folder" ? "a" : "b";
                r.insertText = it.type === "folder" ? it.path + "/" : it.path;
                if (it.type === "folder") {
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

  async doSearchWithCache(
    registry: SupportedRegistryType
  ): Promise<ModInfoList> {
    const cache = this.mod_list_cache?.get();
    if (cache !== undefined) {
      return cache[registry];
    }
    return getRegistries()[registry].modList();
  }

  async doModTreeWithCache(
    registry: SupportedRegistryType,
    mod: string,
    version: string[]
  ): Promise<ModVersionMap> {
    const cache: ModTreeCacheContent | undefined = this.mod_tree_cache?.get();
    let ver: string;
    if (version.length === 0) {
      const mod_info = await getRegistries()[registry].modVersionList(mod);
      if (mod_info?.versions !== undefined) {
        ver = mod_info.versions[0];
      } else {
        return {};
      }
    } else {
      ver = version[0];
    }

    if (
      cache !== undefined &&
      cache[registry][getKeyOfVersionMap(mod, ver)] !== undefined
    ) {
      return cache[registry];
    } else if (this.mod_tree_cache !== undefined) {
      const mod_contents: ModVersionMap = await getRegistries()[
        registry
      ].modContents(mod, [ver]);
      const result: ModTreeCacheContent = {
        "deno.land": {},
        "x.nest.land": {},
        ...cache,
      };
      result[registry][getKeyOfVersionMap(mod, ver)] =
        mod_contents[getKeyOfVersionMap(mod, ver)];
      await this.mod_tree_cache.set(result);
      return mod_contents;
    } else {
      throw "Unreachable code: modTreeCache is undefined";
    }
  }

  async clearCache(): Promise<void> {
    await this.mod_list_cache?.destroy_cache();
    await this.mod_tree_cache?.destroy_cache();
  }

  async cacheModList(): Promise<CACHE_STATE> {
    const progress = await this.connection.window.createWorkDoneProgress();
    progress.begin("Fetching third-party module list...", 0);
    if (!this.mod_list_cache) {
      this.mod_list_cache = await PermCache.create<ModListCacheContent>(
        "mod_list",
        60 * 60 * 24 /* expiring in a day */
      );
    }

    const cache_content = this.mod_list_cache.get();
    if (
      this.mod_list_cache.expired() ||
      !cache_content ||
      Object.keys(cache_content).length === 0
    ) {
      await this.mod_list_cache.destroy_cache();
      this.mod_list_cache = await PermCache.create<ModListCacheContent>(
        "mod_list",
        60 * 60 * 24 /* expiring in a day */
      );
      progress.report(0);
      if (
        this.mod_list_cache.transaction_begin() === TRANSACTION_STATE.SUCCESS
      ) {
        let index = 0;
        const total = SupportedRegistry.length;
        for (const registry of SupportedRegistry) {
          const mods = await getRegistries()[registry].modList();
          const old_cache = this.mod_list_cache.transaction_get().data;
          const new_cache = { ...old_cache };
          new_cache[registry] = mods;
          this.mod_list_cache.transaction_set(new_cache as ModListCacheContent);
          index++;
          progress.report((index / total) * 100);
        }
        await this.mod_list_cache.transaction_commit();
        progress.done();
        return CACHE_STATE.CACHE_SUCCESS;
      }
      progress.done();
      return CACHE_STATE.UNKNOWN_ERROR;
    }
    progress.done();
    return CACHE_STATE.ALREADY_CACHED;
  }
}

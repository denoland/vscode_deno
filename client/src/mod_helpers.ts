import * as vscode from "vscode";
import { CompletionItemKind, CompletionItem } from "vscode-languageclient";
import got from "got";
import { realpath } from "fs";

export class CompletionProvider implements vscode.CompletionItemProvider {
  ext_ctx: vscode.ExtensionContext;
  constructor(ext_ctx: vscode.ExtensionContext) {
    this.ext_ctx = ext_ctx;
  }

  public async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext,
  ): Promise<vscode.CompletionItem[] | undefined> {
    let lineText = document.lineAt(position).text;

    if (/import.+?from\W+['"].*?['"]/.test(lineText)) {
      // We're at import statement line
      let currentChar = lineText[position.character - 1];
      if (currentChar === "@") {
        // The user want a list of std lib versions instead of folder or file completion
        let vers = await this.list_std_versions();
        return vers.map((it) =>
          new vscode.CompletionItem(it, CompletionItemKind.Value)
        );
      }

      const gh_baseurl =
        "https://api.github.com/repos/denoland/deno/contents/std?ref=";
      const importUrl = lineText.match(
        /.*?['"](\w+:\/\/)(?<domain>.*?)\/(?<lib>\w+)(@(?<ver>[\d.]+))?\/(?<path>.*?)['"]/,
      ).groups;
      const [domain, lib, ver, path] = [
        importUrl["domain"],
        importUrl["lib"],
        importUrl["ver"],
        importUrl["path"],
      ];
      if (domain === "deno.land" && lib === "std") {
        let entries = path?.split("/") ?? [];
        let entry = entries.splice(-1, 1)[0];
        let realPath = "";
        if (entries.length > 0) {
          realPath += entries.join("/") + "/";
        }
        let result = await this.list_std(ver, realPath);
        return result
          .filter((it) =>
            it.type === "dir" ||
            (it.type === "file" && it.name.endsWith(".ts") &&
              !it.name.endsWith("_test.ts"))
          )
          .filter((it) => !it.name.startsWith("_")) // exclude fodler or file start with _
          .filter((it) =>
            typeof entry === "undefined" ||
            (entry.length === 0 || it.name.startsWith(entry))
          )
          .map((it) =>
            new vscode.CompletionItem(
              it.name,
              it.type === "dir"
                ? CompletionItemKind.Folder
                : CompletionItemKind.File,
            )
          );
      }
      return undefined;
    }
  }

  /**
   * return list of versions
   * e.g. ['0.55.0', '0.56.0']
   */
  async list_std_versions(): Promise<Array<string>> {
    let cache = <Array<string>> this.ext_ctx.globalState.get("version");
    if (typeof cache !== "undefined" && Array.isArray(cache)) {
      return cache;
    }

    let apiUrl = "https://api.github.com/repos/denoland/deno/git/refs/tags";
    let result: Array<GH_Tag> = await got(apiUrl).json();
    let ret = <Array<string>> result
      .filter((it) => it.ref.includes("std"))
      .map((it) => it.ref)
      .map((it) => it.split("/").splice(-1, 1)[0])
      .reverse();
    this.ext_ctx.globalState.update("version", ret);
    return ret;
  }

  /**
   * 
   * @param ver  undefind | '0.xx.x'
   * @param path part of path/to/mod.ts e.g. 'fmt/c'
   * @returns list of GH_Entry
   */
  async list_std(
    ver: string = "master",
    path: string = "",
  ): Promise<Array<GH_Entry>> {
    let cache = <Array<GH_Entry> | undefined> this.ext_ctx.globalState.get(
      `std@${ver}/${path}`,
    );
    if (typeof cache !== "undefined" && Array.isArray(cache)) {
      return cache;
    }

    let url = "https://api.github.com/repos/denoland/deno/contents/std";
    if (ver === "master") {
      url = `${url}/${path}?ref=${ver}`;
    } else {
      url = `${url}/${path}?ref=std/${ver}`;
    }
    let result: Array<GH_Entry> = (<GH_Result> await got(url, {
      "headers": {
        "accept": "application/vnd.github.v3.object",
        "accept-language": "en-US,en;q=0.9",
      },
      "method": "GET",
    }).json())?.entries;

    // cache it
    this.ext_ctx.globalState.update(
      `std@${ver}/${path}`,
      result.map((it) =>
        <GH_Entry> { name: it.name, type: it.type, url: it.url }
      ),
    );

    return result as Array<GH_Entry>;
  }
}

interface GH_Entry {
  name: string;
  type: string;
  url: string;
}

interface GH_Result {
  entries: Array<GH_Entry>;
}

interface GH_Tag {
  ref: string;
}

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
        let entrys = path?.split("/") ?? [];
        let entry = entrys.splice(-1, 1)[0];
        let realPath = "";
        if (entrys.length > 0) {
          realPath += entrys.join("/") + "/";
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

  async list_std(
    ver: string = "master",
    path: string = "",
  ): Promise<Array<GH_Entries>> {
    let cache = <Array<GH_Entries> | undefined> this.ext_ctx.globalState.get(
      `std@${ver}/${path}`,
    );
    if (cache !== undefined && Array.isArray(cache)) {
      return cache;
    }

    let url = "https://api.github.com/repos/denoland/deno/contents/std";
    if (ver === "master") {
      url = `${url}/${path}?ref=${ver}`;
    } else {
      url = `${url}/${path}?ref=std/${ver}`;
    }
    let result: Array<GH_Entries> = (<GH_Result> await got(url, {
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
        <GH_Entries> { name: it.name, type: it.type, url: it.url }
      ),
    );

    return result as Array<GH_Entries>;
  }
}

interface GH_Entries {
  name: string;
  type: string;
  url: string;
}

interface GH_Result {
  entries: Array<GH_Entries>;
}

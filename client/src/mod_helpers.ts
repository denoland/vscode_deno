import * as vscode from "vscode";
import { CompletionItemKind } from "vscode-languageclient";
import got from "got";

export class CompletionProvider implements vscode.CompletionItemProvider {
  public async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext,
  ): Promise<vscode.CompletionItem[] | undefined> {
    let lineText = document.lineAt(position).text;

    if (/import.+?from\W+['"].*?['"]/.test(lineText)) {
      // We're at import statement line
      const gh_baseurl = 'https://api.github.com/repos/denoland/deno/contents/std?ref='
      const importUrl = lineText.match(/.*?['"](\w+:\/\/)(?<domain>.*?)\/(?<lib>\w+)(@(?<ver>[\d.]+))?\/(?<path>.*?)['"]/).groups;
      const [domain, lib, ver, path] = [importUrl['domain'], importUrl['lib'], importUrl['ver'], importUrl['path']]
      if (domain === 'deno.land' && lib === 'std') {
        let result = await list_std(ver, path);
        let entrys = path.split('/')
        let entry = entrys[entrys.length - 1];
        return result
          .filter((it) => it.type === "dir" || (it.type === "file" && it.name.endsWith(".ts") && !it.name.endsWith("_test.ts")))
          .filter((it) => !it.name.startsWith("_")) // exclude fodler or file start with _
          .filter((it) => entry.length === 0 || it.name.startsWith(entry))
          .map((it) => new vscode.CompletionItem(it.name));
      }
      return undefined;
    }
  }
}

interface GH_Entries {
  name: string,
  type: string,
  url: string
}

interface GH_Result {
  entries: Array<GH_Entries>
}

async function list_std(ver: string = "master", path: string = ""): Promise<Array<GH_Entries>> {
  // TODO: cache the result

  let url = "https://api.github.com/repos/denoland/deno/contents/std";
  if (ver === "master") {
    url = `${url}/${path}?ref=${ver}`
  } else {
    url = `${url}/${path}?ref=std/${ver}`
  }
  let result: Array<Object> = (<GH_Result>await got(url, {
    "headers": {
      "accept": "application/vnd.github.v3.object",
      "accept-language": "en-US,en;q=0.9",
    },
    "method": "GET",
  }).json())?.entries;

  return result as Array<GH_Entries>;
}

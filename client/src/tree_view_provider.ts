import * as path from "path";

import {
  TreeDataProvider,
  TreeItem,
  workspace,
  TreeItemCollapsibleState,
  Uri,
  EventEmitter,
  Event,
  commands,
  window,
  Range
} from "vscode";
import { Extension } from "./extension";

import { str2regexpStr } from "../../core/util";
import { Position } from "../../core/deno_deps";
import { Disposable } from "vscode-languageclient";

interface URLDep {
  filepath: string;
  location: { start: Position; end: Position };
}

enum ItemType {
  Workspace = 1,
  URL = 2,
  Reference = 3
}

interface Item extends TreeItem {
  parentNode?: Item;
  type: ItemType;
  references?: URLDep[];
}

export class TreeViewProvider implements TreeDataProvider<Item> {
  // tree view event
  private privateOnDidChangeTreeData: EventEmitter<
    Item | undefined
  > = new EventEmitter<Item | undefined>();
  public readonly onDidChangeTreeData: Event<Item | undefined> = this
    .privateOnDidChangeTreeData.event;

  private disposable: Disposable[] = [];

  constructor(private extension: Extension) {
    this.disposable.push(
      commands.registerCommand("deno._refresh_tree", () => {
        this.refresh();
      })
    );

    this.disposable.push(
      commands.registerCommand(
        "deno._open_file",
        async (
          filepath: string,
          location: {
            start: { line: number; character: number };
            end: { line: number; character: number };
          }
        ) => {
          this.refresh();
          const document = await await workspace.openTextDocument(filepath);
          await window.showTextDocument(document, {
            selection: new Range(
              location.start.line,
              location.start.character,
              location.end.line,
              location.end.character
            )
          });
        }
      )
    );
  }
  async getTreeItem(element: Item) {
    return element;
  }
  async getChildren(element?: Item): Promise<Item[]> {
    // if not element. then show workspace folder
    if (!element) {
      const workspaceFolders = workspace.workspaceFolders || [];
      return (
        workspaceFolders
          // only list the workspace which already set `deno.enable: true`
          .filter(v => this.extension.getConfiguration(v.uri).enable)
          .map(v => {
            const item: Item = {
              resourceUri: v.uri,
              type: ItemType.Workspace,
              label: v.name,
              collapsibleState: TreeItemCollapsibleState.Collapsed
            };

            return item;
          })
      );
    }

    // Get dependencies of the project
    if (element.type === ItemType.Workspace) {
      const depsMap = (await this.extension.client?.sendRequest(
        "getDependencyTreeOfProject",
        element.resourceUri?.toString()
      )) as { [url: string]: URLDep[] };

      const deps = Object.keys(depsMap);

      return deps.map(url => {
        const item: Item = {
          parentNode: element,
          iconPath: {
            light: path.join(
              this.extension.context.extensionPath,
              "resource",
              "icon",
              "url.light.svg"
            ),
            dark: path.join(
              this.extension.context.extensionPath,
              "resource",
              "icon",
              "url.dark.svg"
            )
          },
          resourceUri: Uri.parse(url),
          type: ItemType.URL,
          label: url,
          collapsibleState: TreeItemCollapsibleState.Collapsed,
          references: depsMap[url]
        };

        return item;
      });
    }

    // Get the location of the dependency
    if (!element.references) {
      return [];
    }

    return element.references.map(r => {
      const workspaceFolderFilepath =
        element.parentNode?.resourceUri?.fsPath + path.sep;

      const filename = r.filepath
        .replace(
          new RegExp("^" + str2regexpStr(workspaceFolderFilepath as string)),
          ""
        )
        .replace(new RegExp(str2regexpStr(path.sep), "gm"), path.posix.sep);

      const item: Item = {
        parentNode: element,
        resourceUri: Uri.file(r.filepath),
        type: ItemType.Reference,
        label: filename,
        description: `Line ${r.location.start.line + 1}, Col ${r.location.start
          .character + 1}`,
        collapsibleState: TreeItemCollapsibleState.None,
        command: {
          title: "Open the file",
          command: "deno._open_file",
          arguments: [r.filepath, r.location]
        }
      };

      return item;
    });
  }
  refresh(): void {
    this.privateOnDidChangeTreeData.fire();
  }
  dispose(): void {
    this.privateOnDidChangeTreeData.dispose();
    for (const disposable of this.disposable) {
      disposable.dispose();
    }
  }
}

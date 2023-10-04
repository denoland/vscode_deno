import * as path from "path";
import * as fs from "fs";
import {
  commands, Event, EventEmitter, ExtensionContext, Task, tasks, ThemeIcon, TreeDataProvider, TreeItem, TreeItemCollapsibleState, Uri, window, workspace, WorkspaceFolder, TaskProvider, ProcessExecution, Position, Selection, TextDocument
} from "vscode";
import { getDenoCommandName, isWorkspaceFolder, readTaskDefinitions } from "./util";
import { DenoExtensionContext } from "./types";
import { task as taskReq } from "./lsp_extensions";



class Folder extends TreeItem {
  configs: DenoJSON[] = [];
  workspaceFolder: WorkspaceFolder;

  constructor(folder: WorkspaceFolder) {
    super(folder.name, TreeItemCollapsibleState.Expanded);
    this.contextValue = "folder";
    this.resourceUri = folder.uri;
    this.workspaceFolder = folder;
    this.iconPath = ThemeIcon.Folder;
  }

  addConfig(config: DenoJSON) {
    this.configs.push(config);
  }
}

class DenoJSON extends TreeItem {
  tasks: DenoTask[] = [];

  constructor(
    public readonly folder: Folder,
    relativePath: string,
    fileName: string
  ) {
    const label = relativePath.length > 0 ?
      path.join(relativePath, fileName) :
      fileName;
    super(label, TreeItemCollapsibleState.Expanded);

    this.contextValue = "denoJSON";

    this.resourceUri = Uri.file(
      path.join(folder.resourceUri!.fsPath, relativePath, fileName)
    );

    this.iconPath = ThemeIcon.File;
  }

  addTask(task: DenoTask) {
    this.tasks.push(task);
  }
}

type DefaultCommand = "open" | "run";

class DenoTask extends TreeItem {
  constructor(
    public denoJson: DenoJSON,
    public task: Task
  ) {
    const name = task.name;
    super(name, TreeItemCollapsibleState.None);
    const defaultCommand =
      workspace.getConfiguration("deno").get<DefaultCommand>("defaultTaskCommand")
      ?? "open";

    const commandList = {
      "open": {
        title: "Edit Task",
        command: "deno.task.definition.open",
        arguments: [this]
      },
      "run": {
        title: "Run Task",
        command: "deno.task.run",
        arguments: [this]
      }
    };
    this.contextValue = "script";
    this.denoJson = denoJson;
    this.task = task;
    this.command = commandList[defaultCommand];
    this.iconPath = new ThemeIcon("wrench");

    if (this.task.definition.command) {
      this.tooltip = this.task.definition.command;
      this.description = this.task.definition.command;
    }
  }

  getFolder(): WorkspaceFolder {
    return this.denoJson.folder.workspaceFolder;
  }
}

function buildDenoConfigTask(
  scope: WorkspaceFolder,
  process: string,
  name: string,
  fileName: string,
  command?: string,
): Task {
  const execution = new ProcessExecution(process, ["task", name]);

  const task = new Task(
    { type: "deno", name, command, fileName },
    scope,
    name,
    "deno task",
    execution,
    ["$deno"],
  );
  task.detail = command;
  return task;
}

class NoScripts extends TreeItem {
  constructor(message: string) {
    super(message, TreeItemCollapsibleState.None);
    this.contextValue = "noscripts";
  }
}

class DenoTaskProvider implements TaskProvider {
  #extensionContext: DenoExtensionContext;

  constructor(extensionContext: DenoExtensionContext) {
    this.#extensionContext = extensionContext;
  }

  async provideTasks(): Promise<Task[]> {
    const tasks: Task[] = [];

    const process = await getDenoCommandName();

    // we retrieve config tasks from the language server, if the language server
    // supports the capability
    const client = this.#extensionContext.client;
    const supportsConfigTasks = this.#extensionContext.serverCapabilities
      ?.experimental?.denoConfigTasks;
    if (client && supportsConfigTasks) {
      try {
        const configTasks = await client.sendRequest(taskReq);
        if (configTasks) {
          for (const workspaceFolder of workspace.workspaceFolders ?? []) {
            // Check if config file is .json or .jsonc
            let fileName = "deno.json";
            try {
              const filePath = path.join(workspaceFolder.uri.fsPath, fileName);
              fs.accessSync(filePath, fs.constants.F_OK);
            } catch {
              fileName = "deno.jsonc";
            }
            for (const { name, detail: command } of configTasks) {
              tasks.push(
                buildDenoConfigTask(workspaceFolder, process, name, fileName, command),
              );
            }
          }
        }
      } catch (err) {
        window.showErrorMessage("Failed to retrieve config tasks.");
        this.#extensionContext.outputChannel.appendLine(
          `Error retrieving config tasks: ${err}`,
        );
      }
    }

    return tasks;
  }

  async resolveTask(task: Task): Promise<Task | undefined> {
    return task;
  }
}

type TaskTree = Folder[] | DenoJSON[] | NoScripts[];

export class DenoTasksTreeDataProvider implements TreeDataProvider<TreeItem> {
  #taskTree: TaskTree | null = null;
  #extensionContext: DenoExtensionContext;
  #onDidChangeTreeData = new EventEmitter<TreeItem | null>();
  readonly onDidChangeTreeData = this.#onDidChangeTreeData.event;

  constructor(
    context: DenoExtensionContext,
    public taskProvider: DenoTaskProvider,
    subscriptions: ExtensionContext["subscriptions"]
  ) {
    this.#extensionContext = context;
    subscriptions.push(commands.registerCommand("deno.task.run", this.#runTask, this));
    subscriptions.push(commands.registerCommand(
      "deno.task.debug",
      this.#debugTask,
      this
    ));
    subscriptions.push(commands.registerCommand(
      "deno.task.definition.open",
      this.#openTaskDefinition,
      this
    ));
  }

  async #runTask(task: DenoTask) {
    tasks.executeTask(task.task);
  }

  async #debugTask(task: DenoTask) {
    const command = `${await getDenoCommandName()} task ${task.task.name}`;
    commands.executeCommand(
      "extension.js-debug.createDebuggerTerminal",
      command,
      task.getFolder(),
      {
        cwd: path.dirname(task.denoJson.resourceUri!.fsPath)
      },
    );
  }

  #findTaskPosition(document: TextDocument, task?: DenoTask) {
    const taskDefinitions = readTaskDefinitions(document);
    if (taskDefinitions === undefined) return;

    if (!task) return taskDefinitions.location.range.start;

    return taskDefinitions.tasks.find(s => s.name === task.task.name)
      ?.commandRange.start;
  }

  async #openTaskDefinition(selection: DenoJSON | DenoTask) {
    let uri: Uri;
    if (selection instanceof DenoJSON) {
      uri = selection.resourceUri!;
    } else if (selection instanceof DenoTask) {
      uri = selection.denoJson.resourceUri!;
    } else {
      return;
    }
    const document = await workspace.openTextDocument(uri);
    const position = this.#findTaskPosition(
      document,
      selection instanceof DenoTask ? selection : undefined
    ) ?? new Position(0, 0);
    await window.showTextDocument(document, {
      selection: new Selection(position, position)
    });
  }

  public refresh() {
    this.#taskTree = null;
    this.#onDidChangeTreeData.fire(null);
  }

  getTreeItem(element: TreeItem): TreeItem {
    return element;
  }

  getParent(element: TreeItem): TreeItem | null {
    if (element instanceof Folder) {
      return null;
    }
    if (element instanceof DenoJSON) {
      return element.folder;
    }
    if (element instanceof DenoTask) {
      return element.denoJson;
    }
    if (element instanceof NoScripts) {
      return null;
    }
    return null;
  }

  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    if (!this.#taskTree) {
      const taskItems = await this.taskProvider.provideTasks();
      if (taskItems) {
        this.#taskTree = await this.#buildTaskTree(taskItems);
        // this.taskTree = this.sortTaskTree(this.#taskTree);
        if (this.#taskTree.length === 0) {
          this.#taskTree = [new NoScripts("No scripts found.")];
        }
      }
    }
    if (element instanceof Folder) {
      return element.configs;
    }
    if (element instanceof DenoJSON) {
      return element.tasks;
    }
    if (element instanceof DenoTask) {
      return [];
    }
    if (element instanceof NoScripts) {
      return [];
    }
    if (!element) {
      if (this.#taskTree) {
        return this.#taskTree;
      }
    }
    return [];
  }

  async #buildTaskTree(tasks: Task[]) {
    const folders = new Map<string, Folder>();
    const configs = new Map<String, DenoJSON>();

    for (const task of tasks) {
      if (!isWorkspaceFolder(task.scope)) continue;

      let folder = folders.get(task.scope.name);
      if (!folder) {
        folder = new Folder(task.scope);
        folders.set(task.scope.name, folder);
      }

      const definition = task.definition;
      const relativePath = definition.path ? definition.path : "";
      const fullPath = path.join(task.scope.name, relativePath);

      let denoJson = configs.get(fullPath);
      if (!denoJson) {
        let fileName = "deno.json";
        try {
          const filePath = path.join(task.scope.uri.fsPath, relativePath, fileName);
          fs.accessSync(filePath, fs.constants.F_OK);
        } catch {
          fileName = "deno.jsonc";
        }
        denoJson = new DenoJSON(folder, relativePath, fileName);
        folder.addConfig(denoJson);
        configs.set(fullPath, denoJson);
      }
      denoJson.addTask(new DenoTask(denoJson, task));
    }
    if (folders.size === 1) {
      return [...configs.values()];
    }
    return [...folders.values()];
  }
}

export function registerSidebar(
  context: DenoExtensionContext,
  subscriptions: ExtensionContext["subscriptions"]
): DenoTasksTreeDataProvider | undefined {
  if (!workspace.workspaceFolders) return;

  const taskProvider = new DenoTaskProvider(context);
  subscriptions.push(tasks.registerTaskProvider("denoTasks", taskProvider));

  const treeDataProvider = new DenoTasksTreeDataProvider(
    context, taskProvider, subscriptions);

  const view = window.createTreeView("denoTasks", {
    treeDataProvider,
    showCollapseAll: true
  });
  subscriptions.push(view);

  return treeDataProvider;
}
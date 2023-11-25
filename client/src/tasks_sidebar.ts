import * as path from "path";
import {
  commands,
  EventEmitter,
  ExtensionContext,
  Position,
  ProcessExecution,
  Selection,
  Task,
  TaskProvider,
  tasks,
  TextDocument,
  ThemeIcon,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  Uri,
  window,
  workspace,
  WorkspaceFolder,
} from "vscode";
import {
  getDenoCommandName,
  isWorkspaceFolder,
  readTaskDefinitions,
} from "./util";
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
    sourceUri: Uri,
  ) {
    const label = folder.resourceUri
      ? sourceUri.toString().replace(folder.resourceUri.toString() + "/", "")
      : sourceUri.toString();
    super(label, TreeItemCollapsibleState.Expanded);
    this.contextValue = "denoJSON";
    this.resourceUri = sourceUri;
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
    public task: Task,
  ) {
    const name = task.name;
    super(name, TreeItemCollapsibleState.None);
    const defaultCommand =
      workspace.getConfiguration("deno").get<DefaultCommand>(
        "defaultTaskCommand",
      ) ??
        "open";

    const commandList = {
      "open": {
        title: "Edit Task",
        command: "deno.client.openTaskDefinition",
        arguments: [this],
      },
      "run": {
        title: "Run Task",
        command: "deno.client.runTask",
        arguments: [this],
      },
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
  command: string,
  sourceUri: Uri,
): Task {
  const execution = new ProcessExecution(process, ["task", name]);
  const task = new Task(
    { type: "deno", name, command, sourceUri },
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
        for (const { name, detail: command, sourceUri } of configTasks ?? []) {
          // TODO(nayeemrmn): Deno LSP versions < 1.37.2 doesn't provide the
          // `sourceUri`. Remove this eventually.
          if (!sourceUri) {
            continue;
          }
          const workspaceFolder = (workspace.workspaceFolders ?? []).find((f) =>
            // NOTE: skipEncoding in Uri.toString(), read more at https://github.com/microsoft/vscode/commit/65cb3397673b922c1b6759d145a3a183feb3ee5d
            sourceUri
              .toLocaleLowerCase()
              .startsWith(f.uri.toString(true).toLocaleLowerCase())
          );
          if (!workspaceFolder) {
            continue;
          }

          tasks.push(
            buildDenoConfigTask(
              workspaceFolder,
              process,
              name,
              command,
              Uri.parse(sourceUri),
            ),
          );
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

  // deno-lint-ignore require-await
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
    subscriptions: ExtensionContext["subscriptions"],
  ) {
    this.#extensionContext = context;
    subscriptions.push(
      commands.registerCommand("deno.client.runTask", this.#runTask, this),
    );
    subscriptions.push(commands.registerCommand(
      "deno.client.debugTask",
      this.#debugTask,
      this,
    ));
    subscriptions.push(commands.registerCommand(
      "deno.client.openTaskDefinition",
      this.#openTaskDefinition,
      this,
    ));
    subscriptions.push(commands.registerCommand(
      "deno.client.refreshTasks",
      this.refresh.bind(this),
    ));
  }

  #runTask(task: DenoTask) {
    tasks.executeTask(task.task);
  }

  async #debugTask(task: DenoTask) {
    const command = `${await getDenoCommandName()} task ${task.task.name}`;
    commands.executeCommand(
      "extension.js-debug.createDebuggerTerminal",
      command,
      task.getFolder(),
      {
        cwd: path.dirname(task.denoJson.resourceUri!.fsPath),
      },
    );
  }

  #findTaskPosition(document: TextDocument, task?: DenoTask) {
    const taskDefinitions = readTaskDefinitions(document);
    if (taskDefinitions === undefined) return;

    if (!task) return taskDefinitions.location.range.start;

    return taskDefinitions.tasks.find((s) => s.name === task.task.name)
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
      selection instanceof DenoTask ? selection : undefined,
    ) ?? new Position(0, 0);
    await window.showTextDocument(document, {
      selection: new Selection(position, position),
    });
  }

  public refresh() {
    this.#taskTree = null;
    this.#onDidChangeTreeData.fire(null);
  }

  getTreeItem(item: TreeItem) {
    return item;
  }

  getParent(item: TreeItem) {
    if (item instanceof DenoJSON) return item.folder;
    if (item instanceof DenoTask) return item.denoJson;
    return null;
  }

  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    if (!this.#taskTree) {
      const taskItems = await this.taskProvider.provideTasks();
      if (taskItems) {
        this.#taskTree = this.#buildTaskTree(taskItems);
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

  #buildTaskTree(tasks: Task[]) {
    const folders = new Map<string, Folder>();
    const configs = new Map<string, DenoJSON>();

    for (const task of tasks) {
      if (!isWorkspaceFolder(task.scope)) continue;

      let folder = folders.get(task.scope.name);
      if (!folder) {
        folder = new Folder(task.scope);
        folders.set(task.scope.name, folder);
      }

      const definition = task.definition;
      const sourceUri = definition.sourceUri;

      let denoJson = configs.get(sourceUri.toString());
      if (!denoJson) {
        denoJson = new DenoJSON(folder, sourceUri);
        folder.addConfig(denoJson);
        configs.set(sourceUri.toString(), denoJson);
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
  subscriptions: ExtensionContext["subscriptions"],
): DenoTasksTreeDataProvider | undefined {
  if (!workspace.workspaceFolders) return;

  const taskProvider = new DenoTaskProvider(context);
  subscriptions.push(tasks.registerTaskProvider("denoTasks", taskProvider));

  const treeDataProvider = new DenoTasksTreeDataProvider(
    context,
    taskProvider,
    subscriptions,
  );

  const view = window.createTreeView("denoTasks", {
    treeDataProvider,
    showCollapseAll: true,
  });
  subscriptions.push(view);

  return treeDataProvider;
}

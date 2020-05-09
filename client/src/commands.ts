import * as vscode from "vscode";
import * as lsp from "vscode-languageclient";

/**
 * Represent a vscode command with an ID and an impl function `execute`.
 */
interface Command {
  id: string;
  execute(): Promise<vscode.Disposable>;
}

/**
 * Restart the language server by killing the process then spanwing a new one.
 * @param client LSP language client
 */
function restartDenoServer(client: lsp.LanguageClient): Command {
  return {
    id: "deno.restartDenoServer",
    async execute() {
      await client.stop();
      return client.start();
    },
  };
}

/**
 * Register all supported vscode commands for the Deno extension.
 * @param client LSP language client
 */
export function registerCommands(
  client: lsp.LanguageClient,
): vscode.Disposable[] {
  const commands: Command[] = [
    restartDenoServer(client),
  ];

  const disposables = commands.map((command) => {
    return vscode.commands.registerCommand(command.id, command.execute);
  });

  return disposables;
}

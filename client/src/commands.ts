// Copyright 2019-2020 the Deno authors. All rights reserved. MIT license.

import * as vscode from "vscode";
import * as lsp from "vscode-languageclient";
import {
  ExecuteCommandRequest,
  RevealOutputChannelOn,
} from "vscode-languageclient";

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

function clearComplementationCache(ctx: vscode.ExtensionContext): Command {
  return {
    id: "deno.clearComplementationCache",
    async execute() {
      try {
        let keys = await ctx.globalState.get("keys");
        await ctx.globalState.update("version", undefined);
        if (Array.isArray(keys)) {
          await keys.forEach(async (it) =>
            await ctx.globalState.update(it, undefined)
          );
        }
        vscode.window.showInformationMessage("Clear success!");
      } catch (e) {
        vscode.window.showErrorMessage("Clear faild");
      }
      return { dispose() {} };
    },
  };
}

/**
 * Register all supported vscode commands for the Deno extension.
 * @param client LSP language client
 * @param ctx  VSCode extension context
 */
export function registerCommands(
  client: lsp.LanguageClient,
  ctx: vscode.ExtensionContext,
): vscode.Disposable[] {
  const commands: Command[] = [
    restartDenoServer(client),
    clearComplementationCache(ctx),
  ];

  const disposables = commands.map((command) => {
    return vscode.commands.registerCommand(command.id, command.execute);
  });

  return disposables;
}

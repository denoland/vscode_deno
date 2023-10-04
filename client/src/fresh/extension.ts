// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

import * as vscode from "vscode";
import * as snippets from "./snippets";
import { join } from "path";
import {
  generateComponent,
  generateIsland,
  generateLayout,
  generateRoute,
} from "./generate";
import { FreshRouteViewProvider } from "./webview";

const getRootPath = () => vscode.workspace?.workspaceFolders?.[0]?.uri?.fsPath;

async function isFreshProject() {
  const workspace = getRootPath();
  if (!workspace) {
    return false;
  }
  const freshGenPath = join(
    workspace,
    "fresh.gen.ts",
  );
  let fileExists = null;
  try {
    fileExists = await vscode.workspace.fs.stat(vscode.Uri.file(freshGenPath))
  } catch (_error) {
    // do nothing
  }
  return !!fileExists;
}
export function activate(context: vscode.ExtensionContext) {
  isFreshProject().then((isFresh) => {
    vscode.commands.executeCommand(
      "setContext",
      "is-fresh-project",
      isFresh,
    );
  });
  
  context.subscriptions.push(vscode.commands.registerCommand(
    "deno.fresh.generateRoute",
    generateRoute,
  ));

  context.subscriptions.push(vscode.commands.registerCommand(
    "deno.fresh.generateLayout",
    generateLayout,
  ));

  context.subscriptions.push(vscode.commands.registerCommand(
    "deno.fresh.generateComponent",
    generateComponent,
  ));

  context.subscriptions.push(vscode.commands.registerCommand(
    "deno.fresh.generateIsland",
    generateIsland,
  ));

  const provider = vscode.languages.registerCompletionItemProvider(
    "typescriptreact",
    {
      provideCompletionItems(
        _document: vscode.TextDocument,
        _position: vscode.Position,
        _token: vscode.CancellationToken,
        _context: vscode.CompletionContext,
      ) {
        return [
          snippets.simpleRoute,
          snippets.customHandlers,
          snippets.layout,
          snippets.defineRoute,
          snippets.defineLayout,
        ];
      },
    },
  );

  context.subscriptions.push(provider);

  const webviewProvider = new FreshRouteViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "deno.fresh.routeView",
      webviewProvider,
    ),
  );
}

// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

import { RegistryStateParams } from "./lsp_extensions";
import { NotificationHandler } from "vscode-languageclient";
import * as vscode from "vscode";

export function createRegistryStateHandler(): NotificationHandler<
  RegistryStateParams
> {
  return async function handler({ origin, suggestions }) {
    if (suggestions) {
      const selection = await vscode.window.showInformationMessage(
        `The server "${origin}" supports completion suggestions for imports. Do you wish to enable this? (Only do this if you trust "${origin}") [Learn More](https://github.com/denoland/vscode_deno/blob/main/docs/ImportCompletions.md)`,
        "No",
        "Enable",
      );
      const enable = selection === "Enable";
      const suggestImportsConfig = vscode.workspace.getConfiguration(
        "deno.suggest.imports",
      );
      const hosts: Record<string, boolean> =
        suggestImportsConfig.get("hosts") ??
          {};
      hosts[origin] = enable;
      await suggestImportsConfig.update(
        "hosts",
        hosts,
        vscode.ConfigurationTarget.Workspace,
      );
    }
  };
}

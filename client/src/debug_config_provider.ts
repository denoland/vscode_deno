import * as vscode from "vscode";
import type { Settings } from "./interfaces";

export class DenoDebugConfigurationProvider
  implements vscode.DebugConfigurationProvider {
  #getSettings: () => Settings;

  constructor(getSettings: () => Settings) {
    this.#getSettings = getSettings;
  }

  provideDebugConfigurations(): vscode.ProviderResult<
    vscode.DebugConfiguration[]
  > {
    return [
      {
        name: "Deno: Run",
        request: "launch",
        type: "pwa-node",
        program: "main.ts",
        cwd: "${workspaceFolder}",
        runtimeExecutable: "deno",
        runtimeArgs: [
          "run",
          ...(this.#getSettings().unstable ? ["--unstable"] : []),
          "--inspect-brk",
          "--allow-all",
        ],
        attachSimplePort: 9229,
      },
    ];
  }

  async resolveDebugConfiguration(
    workspace: vscode.WorkspaceFolder | undefined,
    config: vscode.DebugConfiguration,
  ): Promise<vscode.DebugConfiguration | null | undefined> {
    // if launch.json is missing or empty
    if (!config.type && !config.request && !config.name) {
      const editor = vscode.window.activeTextEditor;
      const langId = editor?.document.languageId;
      if (
        editor &&
        (langId === "typescript" || langId === "javascript" ||
          langId === "typescriptreact" || langId === "javascriptreact")
      ) {
        // https://github.com/microsoft/vscode/issues/106703#issuecomment-694595773
        // Bypass the bug of the vscode 1.49.0
        vscode.debug.startDebugging(workspace, {
          name: "Deno: Run",
          request: "launch",
          type: "pwa-node",
          program: "${file}",
          runtimeExecutable: "deno",
          runtimeArgs: [
            "run",
            ...(this.#getSettings().unstable ? ["--unstable"] : []),
            "--inspect-brk",
            "--allow-all",
          ],
          attachSimplePort: 9229,
        });
        return undefined;
      }
      return null;
    }

    if (!config.program) {
      await vscode.window.showErrorMessage("Cannot resolve a program to debug");
      return undefined;
    }

    return config;
  }
}

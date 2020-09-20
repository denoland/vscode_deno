import {
  ExtensionContext,
  debug,
  WorkspaceFolder,
  DebugConfiguration,
  DebugConfigurationProvider,
  ProviderResult,
  window,
} from "vscode";

export interface DenoCmd {
  name: string;
  entrypoint: string;
  security_flags: string;
  port: string;
}

export function activeDenoDebug(context: ExtensionContext): void {
  context.subscriptions.push(
    debug.registerDebugConfigurationProvider(
      "deno",
      new DenoDebugConfigurationProvider()
    )
  );
}

export class DenoDebugConfigurationProvider
  implements DebugConfigurationProvider {
  provideDebugConfigurations(): ProviderResult<DebugConfiguration[]> {
    return [
      {
        name: "Deno: debug example(Allow all)",
        request: "launch",
        type: "pwa-node",
        program: "main.ts",
        cwd: "${workspaceFolder}",
        runtimeExecutable: "deno",
        runtimeArgs: ["run", "--inspect-brk", "-A"],
        attachSimplePort: 9229,
      },
    ];
  }

  resolveDebugConfiguration(
    workspace: WorkspaceFolder | undefined,
    config: DebugConfiguration
  ): ProviderResult<DebugConfiguration> {
    // if launch.json is missing or empty
    if (!config.type && !config.request && !config.name) {
      const editor = window.activeTextEditor;
      const langid = editor?.document.languageId;
      if (
        editor &&
        (langid === "typescript" ||
          langid === "javascript" ||
          langid === "typescriptreact" ||
          langid === "javascriptreact")
      ) {
        // https://github.com/microsoft/vscode/issues/106703#issuecomment-694595773
        // Bypass the bug of the vscode 1.49.0
        debug.startDebugging(workspace, {
          name: "Deno: Debug",
          request: "launch",
          type: "pwa-node",
          program: "${file}",
          runtimeExecutable: "deno",
          runtimeArgs: ["run", "--inspect-brk"],
          attachSimplePort: 9229,
        });
        return undefined;
      }
      return null;
    }

    if (!config.program) {
      return window
        .showInformationMessage("Cannot find a program to debug")
        .then(() => {
          return undefined; // abort launch
        });
    }

    return config;
  }
}

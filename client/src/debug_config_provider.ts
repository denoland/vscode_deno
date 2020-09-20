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
        name: "Debug deno program",
        request: "launch",
        type: "pwa-node",
        cwd: "${workspaceFolder}",
        program: "main.ts",
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
        config.__workspaceFolder = workspace?.uri.fsPath;
        config.type = "pwa-node";
        config.name = "Launch";
        config.request = "launch";
        config.program = "${file}";
        config.runtimeExecutable = "deno";
        config.runtimeArgs = ["run", "--inspect-brk", "-A"];
        config.attachSimplePort = 9229;
        return config;
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

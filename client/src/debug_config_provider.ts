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

export function activeDenoDebug(context: ExtensionContext) {
  context.subscriptions.push(
    debug.registerDebugConfigurationProvider(
      "deno",
      new DenoDebugConfigurationProvider()
    )
  );
}

export class DenoDebugConfigurationProvider
  implements DebugConfigurationProvider {
  provideDebugConfigurations(
    _folder: WorkspaceFolder | undefined
  ): ProviderResult<DebugConfiguration[]> {
    return [
      {
        name: "${2:Debug Deno program}",
        request: "launch",
        type: "pwa-node",
        program : "^\"\\${workspaceFolder}/${1:main.ts}\"",
        cwd: "^\"\\${workspaceFolder}\"",
        runtimeExecutable : "deno",
        runtimeArgs : ["run", "--inspect-brk", "${3:-A}"],
        attachSimplePort : 9229,
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
        .then((_) => {
          return undefined; // abort launch
        });
    }

    return config;
  }
}

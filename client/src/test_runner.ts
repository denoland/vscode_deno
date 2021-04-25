// Copyright (c) 2017 Tristan Teufel https://github.com/firsttris/vscode-jest-runner MIT license.
// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.
import {
  commands,
  debug,
  DebugConfiguration,
  Terminal,
  TextEditor,
  window,
  workspace,
} from "vscode";
import { Callback } from "./commands";

export class TestRunner {
  private terminal?: Terminal;
  constructor(readonly denoPath: string, readonly unstable: boolean) {
    window.onDidCloseTerminal(() => {
      this.terminal = undefined;
    });
  }
  readonly runTestCommand = (): Callback => {
    return async (arg: object | string) => {
      // object passed from context menu execution
      const testName = typeof arg === "string" ? arg : undefined;
      return this.runTest(testName);
    };
  };
  readonly debuTestCommand = (): Callback => {
    return async (arg: object | string) => {
      const testName = typeof arg === "string" ? arg : undefined;
      return this.debugTest(testName);
    };
  };
  async runTest(testName?: string) {
    const editor = window.activeTextEditor;
    if (!editor) {
      return;
    }
    await editor.document.save();
    const filePath = editor.document.fileName;
    const args = [this.denoPath, "test", "-A", filePath];
    if (testName) {
      args.push("--filter", `"${testName}"`);
    }
    if (this.unstable) {
      args.push("--unstable");
    }
    const command = args.join(" ");
    await this.goToCwd();
    await this.runTerminalCommand(command);
  }
  async debugTest(testName?: string) {
    const editor = window.activeTextEditor;
    if (!editor) {
      return;
    }
    await editor.document.save();
    const config = this.getDebugConfig(editor, testName);
    debug.startDebugging(
      workspace.getWorkspaceFolder(editor.document.uri),
      config,
    );
  }
  get cwd() {
    return this.currentWorkspaceFolderPath;
  }
  private async goToCwd() {
    const cwd = this.cwd;
    if (cwd) {
      await this.runTerminalCommand(`cd "${cwd}"`);
    }
  }
  public get currentWorkspaceFolderPath() {
    const uri = window.activeTextEditor?.document.uri;
    if (!uri) return;
    return workspace.getWorkspaceFolder(uri)?.uri.fsPath;
  }
  async runTerminalCommand(command: string) {
    if (!this.terminal) {
      this.terminal = window.createTerminal("deno");
    }
    this.terminal.show();
    await commands.executeCommand("workbench.action.terminal.clear");
    this.terminal.sendText(command);
  }
  private getDebugConfig(
    editor: TextEditor,
    testName?: string,
  ): DebugConfiguration {
    const config: DebugConfiguration = {
      console: "integratedTerminal",
      internalConsoleOptions: "neverOpen",
      name: "Deno: Debug Tests",
      request: "launch",
      type: "pwa-node",
      runtimeExecutable: this.denoPath,
      runtimeArgs: ["test", "--inspect-brk", "-A", editor.document.fileName],
      attachSimplePort: 9229,
    };
    const cwd = this.cwd;
    if (cwd) {
      config.cwd = cwd;
    }
    if (testName) {
      config.runtimeArgs.push("--filter", testName);
    }
    if (this.unstable) {
      config.runtimeArgs.push("--unstable");
    }
    return config;
  }
}

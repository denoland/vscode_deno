// Copyright 2024 the Deno authors. All rights reserved. MIT license.

import * as vscode from "vscode";
import * as path from "path";
import type { DenoExtensionContext } from "./types";
import type { Callback } from "./commands";
import { getDenoCommandPath } from "./util";

interface CoverageLine {
  line: number;
  hitCount: number;
}

interface FileCoverage {
  filePath: string;
  lines: CoverageLine[];
}

function parseLcov(lcov: string): FileCoverage[] {
  const files: FileCoverage[] = [];
  let currentFile: FileCoverage | null = null;

  for (const line of lcov.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("SF:")) {
      if (currentFile) files.push(currentFile);
      currentFile = {
        filePath: trimmed.slice(3),
        lines: [],
      };
    } else if (trimmed.startsWith("DA:") && currentFile) {
      const parts = trimmed.slice(3).split(",");
      if (parts.length === 2) {
        currentFile.lines.push({
          line: parseInt(parts[0], 10),
          hitCount: parseInt(parts[1], 10),
        });
      }
    } else if (trimmed === "end_of_record" && currentFile) {
      files.push(currentFile);
      currentFile = null;
    }
  }
  return files;
}

const coveredDecoration = vscode.window.createTextEditorDecorationType({
  gutterIconPath: undefined,
  isWholeLine: true,
  backgroundColor: "rgba(34, 197, 94, 0.12)",
  overviewRulerColor: "rgba(34, 197, 94, 0.5)",
  overviewRulerLane: vscode.OverviewRulerLane.Right,
});

const uncoveredDecoration = vscode.window.createTextEditorDecorationType({
  isWholeLine: true,
  backgroundColor: "rgba(239, 68, 68, 0.12)",
  overviewRulerColor: "rgba(239, 68, 68, 0.5)",
  overviewRulerLane: vscode.OverviewRulerLane.Right,
});

let activeDecorations: vscode.Disposable | null = null;

export function clearCoverage(): void {
  if (activeDecorations) {
    activeDecorations.dispose();
    activeDecorations = null;
  }
  for (const editor of vscode.window.visibleTextEditors) {
    editor.setDecorations(coveredDecoration, []);
    editor.setDecorations(uncoveredDecoration, []);
  }
}

export function showTestCoverage(
  _context: vscode.ExtensionContext,
  extensionContext: DenoExtensionContext,
): Callback {
  return async () => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders?.length) {
      vscode.window.showErrorMessage("No workspace folder open.");
      return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const denoCommand = await getDenoCommandPath(extensionContext.approvedPaths);
    if (!denoCommand) {
      vscode.window.showErrorMessage(
        "Deno command not found. Ensure Deno is installed and in PATH.",
      );
      return;
    }

    const covDir = path.join(workspaceRoot, ".deno_coverage");
    const terminal = vscode.window.createTerminal("Deno Coverage");
    terminal.show();

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Running Deno test coverage...",
        cancellable: false,
      },
      async () => {
        const { execSync } = await import("child_process");
        try {
          execSync(
            `${denoCommand} test --coverage="${covDir}" --quiet`,
            { cwd: workspaceRoot, stdio: "pipe", timeout: 120_000 },
          );
        } catch {
          // tests may fail — coverage data is still useful
        }
      },
    );

    let lcovOutput: string;
    try {
      const { execSync } = await import("child_process");
      lcovOutput = execSync(
        `${denoCommand} coverage --lcov "${covDir}"`,
        { cwd: workspaceRoot, encoding: "utf-8", timeout: 30_000 },
      ).toString();
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to generate coverage: ${error instanceof Error ? error.message : String(error)}`,
      );
      return;
    }

    const fileCoverages = parseLcov(lcovOutput);

    clearCoverage();

    const decorationSets = new Map<string, {
      covered: vscode.Range[];
      uncovered: vscode.Range[];
    }>();

    for (const fc of fileCoverages) {
      const covered: vscode.Range[] = [];
      const uncovered: vscode.Range[] = [];
      for (const cl of fc.lines) {
        const range = new vscode.Range(cl.line - 1, 0, cl.line - 1, 0);
        if (cl.hitCount > 0) {
          covered.push(range);
        } else {
          uncovered.push(range);
        }
      }
      decorationSets.set(fc.filePath, { covered, uncovered });
    }

    for (const editor of vscode.window.visibleTextEditors) {
      const uri = editor.document.uri.toString();
      let matched = false;
      for (const [filePath, deco] of decorationSets) {
        const fileUri = vscode.Uri.file(filePath).toString();
        if (fileUri === uri || uri.endsWith(filePath)) {
          editor.setDecorations(coveredDecoration, deco.covered);
          editor.setDecorations(uncoveredDecoration, deco.uncovered);
          matched = true;
          break;
        }
      }
      if (!matched) {
        editor.setDecorations(coveredDecoration, []);
        editor.setDecorations(uncoveredDecoration, []);
      }
    }

    const watcher = vscode.window.onDidChangeTextEditorVisibleRanges(
      (e: vscode.TextEditorVisibleRangesChangeEvent) => {
        const uri = e.textEditor.document.uri.toString();
        for (const [filePath, deco] of decorationSets) {
          const fileUri = vscode.Uri.file(filePath).toString();
          if (fileUri === uri || uri.endsWith(filePath)) {
            e.textEditor.setDecorations(coveredDecoration, deco.covered);
            e.textEditor.setDecorations(uncoveredDecoration, deco.uncovered);
            break;
          }
        }
      },
    );

    activeDecorations = watcher;

    terminal.dispose();

    const fileCount = fileCoverages.length;
    const totalLines = fileCoverages.reduce((s, f) => s + f.lines.length, 0);
    const coveredLines = fileCoverages.reduce(
      (s, f) => s + f.lines.filter((l) => l.hitCount > 0).length,
      0,
    );
    const pct = totalLines > 0
      ? Math.round((coveredLines / totalLines) * 100)
      : 0;

    vscode.window.showInformationMessage(
      `Coverage: ${coveredLines}/${totalLines} lines covered (${pct}%) across ${fileCount} files. Decorations applied.`,
    );
  };
}

import { diffChars } from "diff";
import * as fs from "fs/promises";
import * as path from "path";
import * as process from "process";
import { spawnSync } from "child_process";
import * as vscode from "vscode";
import { getDenoCommandName } from "./util";

const SUPPORTED_EXTENSIONS_BY_LANGUAGE_ID = new Map([
  ["jsonc", "jsonc"],
  ["markdown", "md"],
  ["html", "html"],
  ["css", "css"],
  ["scss", "scss"],
  ["sass", "sass"],
  ["less", "less"],
  ["yaml", "yaml"],
  ["sql", "sql"],
  ["svelte", "svelte"],
  ["vue", "vue"],
  ["astro", "astro"],
  ["vento", "vto"],
  ["nunjucks", "njk"],
]);

export const DENO_FORMATTING_EDIT_PROVIDER:
  vscode.DocumentFormattingEditProvider = {
    async provideDocumentFormattingEdits(document, options, _token) {
      // TODO(nayeemrmn): Account for `deno.json` exclude settings.
      const ext = SUPPORTED_EXTENSIONS_BY_LANGUAGE_ID.get(document.languageId);
      if (!ext) {
        throw new Error("Unexpected language ID for client-side formatting.");
      }
      const command = await getDenoCommandName();
      let cwd = path.dirname(document.uri.fsPath);
      while (!isDir(cwd)) {
        const parentDir = path.dirname(cwd);
        if (parentDir == cwd) {
          break;
        }
        cwd = parentDir;
      }
      const configArgs = [];
      if (!options.insertSpaces) {
        configArgs.push("--use-tabs");
      }
      configArgs.push("--indent-width");
      configArgs.push(options.tabSize.toString());
      const input = document.getText();
      const { stdout, stderr, status, error } = spawnSync(command, [
        "fmt",
        "--unstable-component",
        "--unstable-sql",
        "--ext",
        ext,
        ...configArgs,
        "-",
      ], {
        encoding: "utf-8",
        cwd,
        stdio: "pipe",
        input,
        env: {
          ...process.env,
          "NO_COLOR": "1",
        },
      });
      if (error) {
        throw error;
      }
      if (status != 0) {
        throw new Error(`Formatting failed: ${stderr}`);
      }
      // Never empty a file.
      if (stdout.length == 0) {
        return undefined;
      }
      const edits = [];
      let currentOffset = 0;
      for (const change of diffChars(input, stdout)) {
        if (change.added) {
          edits.push(
            vscode.TextEdit.insert(
              document.positionAt(currentOffset),
              change.value,
            ),
          );
        } else {
          const nextOffset = currentOffset + (change.count ?? 0);
          if (change.removed) {
            edits.push(
              vscode.TextEdit.delete(
                new vscode.Range(
                  document.positionAt(currentOffset),
                  document.positionAt(nextOffset),
                ),
              ),
            );
          }
          currentOffset = nextOffset;
        }
      }
      if (edits.length == 0) {
        return undefined;
      }
      return edits;
    },
  };

async function isDir(path: string): Promise<boolean> {
  try {
    const stats = await fs.stat(path);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

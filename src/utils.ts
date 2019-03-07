import * as fs from "fs";
import * as path from "path";

import { promisify } from "util";
import { exec } from "child_process";

const execute = promisify(exec);

import { TextDocument, workspace } from "vscode";

export interface DenoVersion {
  deno: string;
  v8: string;
  typescript: string;
  raw: string;
}

export function packageExists() {
  if (!workspace.rootPath) {
    return false;
  }

  try {
    const filename = path.join(workspace.rootPath, "package.json");
    const stat = fs.statSync(filename);
    return stat && stat.isFile();
  } catch (ignored) {
    return false;
  }
}

export function tsconfigExists() {
  if (!workspace.rootPath) {
    return false;
  }

  try {
    const filename = path.join(workspace.rootPath, "tsconfig.json");
    const stat = fs.statSync(filename);
    return stat && stat.isFile();
  } catch (ignored) {
    return false;
  }
}

export function isTypeScriptDocument(document: TextDocument) {
  return (
    document.languageId === "typescript" ||
    document.languageId === "typescriptreact"
  );
}

export function isJavaScriptDocument(document: TextDocument) {
  return (
    document.languageId === "javascript" ||
    document.languageId === "javascriptreact"
  );
}

export async function getVersions(): Promise<DenoVersion | undefined> {
  try {
    const { stdout, stderr } = await execute("deno -v");

    if (stderr) {
      return;
    }

    const [deno, v8, typescript] = stdout.split("\n");

    return {
      deno: deno.substr(6),
      v8: v8.substr(4),
      typescript: typescript.substr(12),
      raw: stdout
    };
  } catch (e) {
    return;
  }
}

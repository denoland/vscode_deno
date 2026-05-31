// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

import * as path from "path";
import * as vscode from "vscode";

export function createCoverageHandler(
  workspaceFolder: vscode.WorkspaceFolder,
): {
  getCoverageFilePath: () => string;
} {
  let coverageLcovPath: string | undefined;

  return {
    getCoverageFilePath() {
      if (!coverageLcovPath) {
        coverageLcovPath = path.join(
          workspaceFolder.uri.fsPath,
          ".deno-coverage.lcov",
        );
      }
      return coverageLcovPath;
    },
  };
}

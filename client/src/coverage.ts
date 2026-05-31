// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

interface LcovEntry {
  file: string;
  lines: { found: number; hit: number; details: LineDetail[] };
  functions: { found: number; hit: number };
  branches: { found: number; hit: number };
}

interface LineDetail {
  line: number;
  hit: number;
}

function parseLcov(lcovPath: string): LcovEntry[] {
  const entries: LcovEntry[] = [];
  let current: Partial<LcovEntry> | null = null;
  const content = fs.readFileSync(lcovPath, "utf-8");

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed === "end_of_record") {
      if (current?.file && current.lines !== undefined) {
        entries.push(current as LcovEntry);
      }
      current = null;
      continue;
    }

    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) continue;

    const key = trimmed.substring(0, colonIndex);
    const value = trimmed.substring(colonIndex + 1);

    if (key === "SF") {
      current = {
        file: value,
        lines: { found: 0, hit: 0, details: [] },
        functions: { found: 0, hit: 0 },
        branches: { found: 0, hit: 0 },
      };
    } else if (current) {
      switch (key) {
        case "DA": {
          const parts = value.split(",");
          const lineNum = parseInt(parts[0]);
          const hitCount = parseInt(parts[1]);
          current.lines!.found++;
          if (hitCount > 0) current.lines!.hit++;
          current.lines!.details.push({ line: lineNum, hit: hitCount });
          break;
        }
        case "BRDA": {
          const parts = value.split(",");
          current.branches!.found++;
          if (parseInt(parts[3]) > 0) current.branches!.hit++;
          break;
        }
        case "BRF":
          current.branches!.found = parseInt(value);
          break;
        case "BRH":
          current.branches!.hit = parseInt(value);
          break;
        case "LH":
          current.lines!.hit = parseInt(value);
          break;
        case "LF":
          current.lines!.found = parseInt(value);
          break;
        case "FNF":
          current.functions!.found = parseInt(value);
          break;
        case "FNH":
          current.functions!.hit = parseInt(value);
          break;
      }
    }
  }

  return entries;
}

export function createCoverageHandler(
  workspaceFolder: vscode.WorkspaceFolder,
): {
  loadCoverage: (run: vscode.TestRun) => void;
  loadDetailedCoverage: (
    _testRun: vscode.TestRun,
    fileCoverage: vscode.FileCoverage,
    _token: vscode.CancellationToken,
  ) => vscode.FileCoverageDetail[];
} {
  let coveragePath: string | undefined;
  let cachedEntries: LcovEntry[] | undefined;

  const getCoverageFilePath = (): string => {
    if (!coveragePath) {
      coveragePath = path.join(
        workspaceFolder.uri.fsPath,
        ".deno-coverage.lcov",
      );
    }
    return coveragePath;
  };

  return {
    loadCoverage(run: vscode.TestRun) {
      const lcovPath = getCoverageFilePath();
      try {
        if (!fs.existsSync(lcovPath)) return;
        cachedEntries = parseLcov(lcovPath);

        for (const entry of cachedEntries) {
          const uri = vscode.Uri.file(entry.file);
          const fileCoverage = vscode.FileCoverage.fromDetails(
            uri,
            entry.lines.details.map((d) =>
              new vscode.StatementCoverage(
                d.hit,
                new vscode.Range(
                  new vscode.Position(d.line - 1, 0),
                  new vscode.Position(d.line - 1, 0),
                ),
              )
            ),
          );
          run.addCoverage(fileCoverage);
        }

        // Clean up temp file
        try {
          fs.unlinkSync(lcovPath);
        } catch {
          // ignore
        }
      } catch {
        // Coverage file missing or unreadable
      }
    },

    loadDetailedCoverage(
      _testRun: vscode.TestRun,
      fileCoverage: vscode.FileCoverage,
      _token: vscode.CancellationToken,
    ): vscode.FileCoverageDetail[] {
      if (!cachedEntries) return [];

      const fsPath = fileCoverage.uri.fsPath;
      const entry = cachedEntries.find((e) => e.file === fsPath);
      if (!entry) return [];

      return entry.lines.details.map((d) =>
        new vscode.StatementCoverage(
          d.hit,
          new vscode.Range(
            new vscode.Position(d.line - 1, 0),
            new vscode.Position(d.line - 1, 0),
          ),
        )
      );
    },
  };
}

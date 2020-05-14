// Copyright 2019-2020 the Deno authors. All rights reserved. MIT license.
// Copyright Google Inc. and other 'vscode-ng-language-service' contributors. All Rights Reserved.
// Use of this source code is governed by an MIT-style license that can be
// found in the LICENSE file at https://angular.io/license

import ts from "typescript/lib/tsserverlibrary";
import * as lsp from "vscode-languageserver";
import { URI } from "vscode-uri";

enum Scheme {
  File = "file",
}

/**
 * Extract the file path from the specified `uri`.
 * @param uri
 */
export function uriToFilePath(uri: string): string {
  // Note: uri.path is different from uri.fsPath
  // See
  // https://github.com/microsoft/vscode-uri/blob/413805221cc6ed167186ab3103d3248d6f7161f2/src/index.ts#L622-L645
  const { scheme, fsPath } = URI.parse(uri);
  if (scheme !== Scheme.File) {
    return "";
  }
  return fsPath;
}

/**
 * Converts the specified `filePath` to a proper URI.
 * @param filePath
 */
export function filePathToUri(filePath: string): string {
  return URI.file(filePath).toString();
}

/**
 * Convert ts.TextSpan to lsp.TextSpan. TypeScript keeps track of offset using
 * 1-based index whereas LSP uses 0-based index.
 * @param scriptInfo Used to determine the offsets.
 * @param textSpan
 */
export function tsTextSpanToLspRange(
  scriptInfo: ts.server.ScriptInfo,
  textSpan: ts.TextSpan,
) {
  const start = scriptInfo.positionToLineOffset(textSpan.start);
  const end = scriptInfo.positionToLineOffset(textSpan.start + textSpan.length);
  // ScriptInfo (TS) is 1-based, LSP is 0-based.
  return lsp.Range.create(
    start.line - 1,
    start.offset - 1,
    end.line - 1,
    end.offset - 1,
  );
}

/**
 * Convert lsp.Position to the absolute offset in the file. LSP keeps track of
 * offset using 0-based index whereas TypeScript uses 1-based index.
 * @param scriptInfo Used to determine the offsets.
 * @param position
 */
export function lspPositionToTsPosition(
  scriptInfo: ts.server.ScriptInfo,
  position: lsp.Position,
) {
  const { line, character } = position;
  // ScriptInfo (TS) is 1-based, LSP is 0-based.
  return scriptInfo.lineOffsetToPosition(line + 1, character + 1);
}

/**
 * Convert lsp.Range which is made up of `start` and `end` positions to
 * TypeScript's absolute offsets.
 * @param scriptInfo Used to determine the offsets.
 * @param range
 */
export function lspRangeToTsPositions(
  scriptInfo: ts.server.ScriptInfo,
  range: lsp.Range,
): [number, number] {
  const start = lspPositionToTsPosition(scriptInfo, range.start);
  const end = lspPositionToTsPosition(scriptInfo, range.end);
  return [start, end];
}

/**
 * Convert ts.DiagnosticCategory to lsp.DiagnosticSeverity
 * @param category diagnostic category
 */
function tsDiagnosticCategoryToLspDiagnosticSeverity(
  category: ts.DiagnosticCategory,
) {
  switch (category) {
    case ts.DiagnosticCategory.Warning:
      return lsp.DiagnosticSeverity.Warning;
    case ts.DiagnosticCategory.Error:
      return lsp.DiagnosticSeverity.Error;
    case ts.DiagnosticCategory.Suggestion:
      return lsp.DiagnosticSeverity.Hint;
    case ts.DiagnosticCategory.Message:
    default:
      return lsp.DiagnosticSeverity.Information;
  }
}

/**
 * Convert ts.Diagnostic to lsp.Diagnostic
 * @param tsDiag TS diagnostic
 * @param scriptInfo Used to compute proper offset.
 */
export function tsDiagnosticToLspDiagnostic(
  tsDiag: ts.Diagnostic,
  scriptInfo: ts.server.ScriptInfo,
): lsp.Diagnostic {
  const textSpan: ts.TextSpan = {
    start: tsDiag.start || 0,
    length: tsDiag.length || 0,
  };
  return lsp.Diagnostic.create(
    tsTextSpanToLspRange(scriptInfo, textSpan),
    ts.flattenDiagnosticMessageText(tsDiag.messageText, "\n"),
    tsDiagnosticCategoryToLspDiagnosticSeverity(tsDiag.category),
    tsDiag.code,
    tsDiag.source,
  );
}

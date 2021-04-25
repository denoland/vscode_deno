// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.
import { CodeLens, CodeLensProvider, Range, TextDocument } from "vscode";
import { parse } from "./test_parser";

export class DenoTestCodeLensProvider implements CodeLensProvider {
  public async provideCodeLenses(document: TextDocument): Promise<CodeLens[]> {
    const parseResults = parse(document.fileName, document.getText())
      .map(({ start, end, testName }) => {
        const range = new Range(
          start.line + 2,
          start.character,
          end.line + 2,
          end.character,
        );
        return [
          new CodeLens(range, {
            arguments: [testName],
            command: "deno.runTest",
            title: "Run",
          }),
          new CodeLens(range, {
            arguments: [testName],
            command: "deno.debugTest",
            title: "Debug",
          }),
        ];
      })
      .flat();
    return parseResults;
  }
}

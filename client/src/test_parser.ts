// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.

import * as ts from "typescript";

interface TestBlock {
  start: ts.LineAndCharacter;
  end: ts.LineAndCharacter;
  testName: string;
}

// Extract top-level call expression of Deno.test()
export function parse(filename: string, text: string): TestBlock[] {
  const list: {
    start: ts.LineAndCharacter;
    end: ts.LineAndCharacter;
    testName: string;
  }[] = [];
  const src = ts.createSourceFile(filename, text, ts.ScriptTarget.ESNext);
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (ts.isPropertyAccessExpression(expr)) {
        const deno = expr.expression;
        const func = expr.name;
        if (
          ts.isIdentifier(deno) &&
          deno.text === "Deno" &&
          ts.isIdentifier(func) &&
          func.text === "test"
        ) {
          const arg0 = node.arguments[0];
          if (ts.isStringLiteral(arg0)) {
            const start = src.getLineAndCharacterOfPosition(node.pos);
            const end = src.getLineAndCharacterOfPosition(node.end);
            const testName = arg0.text;
            list.push({ start, end, testName });
            // test("a")
          } else if (ts.isObjectLiteralExpression(arg0)) {
            // test({name: "a"})
            for (const prop of arg0.properties) {
              if (ts.isPropertyAssignment(prop)) {
                const { name, initializer } = prop;
                if (
                  ts.isIdentifier(name) &&
                  name.text === "name" &&
                  ts.isStringLiteral(initializer)
                ) {
                  const start = src.getLineAndCharacterOfPosition(node.pos);
                  const end = src.getLineAndCharacterOfPosition(node.end);
                  const testName = initializer.text;
                  list.push({ start, end, testName });
                  break;
                }
              }
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(src, visit);
  return list;
}

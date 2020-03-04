import * as ts from "typescript";

import { getDenoCompileHint, Range } from "./deno_type_hint";

test("core / deno_type_hint: without compile hint", async () => {
  const sourceFile = ts.createSourceFile(
    "./test.ts",
    `console.log(123)`,
    ts.ScriptTarget.ESNext
  );
  const comments = getDenoCompileHint(ts)(sourceFile);

  expect(comments).toHaveLength(0);
});

test("core / deno_type_hint: with compile hint", async () => {
  const sourceFile = ts.createSourceFile(
    "./test.ts",
    `// @deno-types="./foo.d.ts"
import "./foo.ts"
`,
    ts.ScriptTarget.ESNext
  );
  const [comment] = getDenoCompileHint(ts)(sourceFile);

  expect(comment).not.toBe(undefined);
  expect(comment.module).toEqual("./foo.d.ts");
  expect(comment.text).toEqual(`// @deno-types="./foo.d.ts"`);
  expect(comment.range).toEqual({
    start: { line: 0, character: 0 },
    end: { line: 0, character: 27 }
  } as Range);
  expect(comment.contentRange).toEqual({
    start: { line: 0, character: 16 },
    end: { line: 0, character: 26 }
  } as Range);
});

test("core / deno_type_hint: with compile hint", async () => {
  const sourceFile = ts.createSourceFile(
    "./test.ts",
    `// @deno-types="/absolute/path/to/foo.d.ts"
import "./foo.ts"
`,
    ts.ScriptTarget.ESNext
  );
  const [comment] = getDenoCompileHint(ts)(sourceFile);

  expect(comment).not.toBe(undefined);
  expect(comment.module).toEqual("/absolute/path/to/foo.d.ts");
  expect(comment.text).toEqual(`// @deno-types="/absolute/path/to/foo.d.ts"`);
});

test("core / deno_type_hint: with compile hint 1", async () => {
  const sourceFile = ts.createSourceFile(
    "./test.ts",
    `


// @deno-types="./foo.d.ts"


import "./foo.ts"
`,
    ts.ScriptTarget.ESNext
  );
  const [comment] = getDenoCompileHint(ts)(sourceFile);

  expect(comment).not.toBe(undefined);
  expect(comment.module).toEqual("./foo.d.ts");
  expect(comment.text).toEqual(`// @deno-types="./foo.d.ts"`);
  expect(comment.range).toEqual({
    start: { line: 3, character: 0 },
    end: { line: 3, character: 27 }
  } as Range);
  expect(comment.contentRange).toEqual({
    start: { line: 3, character: 16 },
    end: { line: 3, character: 26 }
  } as Range);
});

test("core / deno_type_hint: with compile hint 2", async () => {
  const sourceFile = ts.createSourceFile(
    "./test.ts",
    `// foo
// bar
// 123
// @deno-types="./foo.d.ts"

/**
 *
 *
 */
/* prefix */ import "./foo.ts" // hasTrailingNewLine
`,
    ts.ScriptTarget.ESNext
  );
  const [comment] = getDenoCompileHint(ts)(sourceFile);

  expect(comment).not.toBe(undefined);
  expect(comment.module).toEqual("./foo.d.ts");
  expect(comment.text).toEqual(`// @deno-types="./foo.d.ts"`);
  expect(comment.range).toEqual({
    start: { line: 3, character: 0 },
    end: { line: 3, character: 27 }
  } as Range);
  expect(comment.contentRange).toEqual({
    start: { line: 3, character: 16 },
    end: { line: 3, character: 26 }
  } as Range);
});

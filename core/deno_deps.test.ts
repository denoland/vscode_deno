import * as path from "path";
import * as ts from "typescript";

import {
  getAllDenoCachedDeps,
  getImportModules,
  ImportModule
} from "./deno_deps";

const TEST_DIR = path.join(__dirname, "..", "__test__");
const denoDir = path.join(TEST_DIR, "deno_dir_manifest");
const denoDepsDir = path.join(denoDir, "deps");

beforeAll(() => {
  process.env["DENO_DIR"] = denoDir;
});

afterAll(() => {
  process.env["DENO_DIR"] = undefined;
});

test("core / deno_deps", async () => {
  const deps = await getAllDenoCachedDeps();

  for (const dep of deps) {
    expect(typeof dep.filepath === "string").toBeTruthy();
    expect(dep.filepath.indexOf(denoDepsDir) == 0).toBeTruthy();
    expect(typeof dep.url === "string").toBeTruthy();
    expect(new URL(dep.url)).toBeTruthy();
  }
});

test("core / getImportModules", async () => {
  const sourceFile = ts.createSourceFile(
    "./test.ts",
    `// comment
import "./foo.ts";
import "/bar.ts";
import("./test.tsx");
import ts = require('typescript');
import test from "test.ts";
import * as test from "test.ts";
export { window } from "export.ts";
export * from "export_as.ts";
export * as xx from "export_as_default.ts";
`,
    ts.ScriptTarget.ESNext
  );

  expect(getImportModules(ts)(sourceFile)).toStrictEqual([
    {
      moduleName: "./foo.ts",
      location: {
        start: { line: 1, character: 8 },
        end: { line: 1, character: 16 }
      }
    },
    {
      moduleName: "/bar.ts",
      location: {
        start: { line: 2, character: 8 },
        end: { line: 2, character: 15 }
      }
    },
    {
      moduleName: "./test.tsx",
      location: {
        start: { line: 3, character: 8 },
        end: { line: 3, character: 18 }
      }
    },
    {
      moduleName: "typescript",
      location: {
        start: { line: 4, character: 21 },
        end: { line: 4, character: 31 }
      }
    },
    {
      moduleName: "test.ts",
      location: {
        start: { line: 5, character: 18 },
        end: { line: 5, character: 25 }
      }
    },
    {
      moduleName: "test.ts",
      location: {
        start: { line: 6, character: 23 },
        end: { line: 6, character: 30 }
      }
    },
    {
      moduleName: "export.ts",
      location: {
        start: { line: 7, character: 24 },
        end: { line: 7, character: 33 }
      }
    },
    {
      moduleName: "export_as.ts",
      location: {
        start: { line: 8, character: 15 },
        end: { line: 8, character: 27 }
      }
    },
    {
      moduleName: "export_as_default.ts",
      location: {
        start: { line: 9, character: 21 },
        end: { line: 9, character: 41 }
      }
    }
  ] as ImportModule[]);
});

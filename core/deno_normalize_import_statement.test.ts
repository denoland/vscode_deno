import * as path from "path";

import { normalizeImportStatement } from "./deno_normalize_import_statement";
import { escapeRegExp } from "./util";

const TEST_DIR = path.join(__dirname, "testdata");
const denoDir = path.join(TEST_DIR, "deno_dir_manifest");

const cacheFilepath = path.join(
  denoDir,
  "deps",
  "https",
  "example.com",
  "933405cb905c548e870daee56d0589b7dd8e146c0cdbd5f16a959f8227c1fe06"
);

beforeAll(() => {
  process.env["DENO_DIR"] = denoDir;
});

afterAll(() => {
  process.env["DENO_DIR"] = undefined;
});

test("core / deno_normalize_import_statement", () => {
  expect(
    normalizeImportStatement(
      __filename,
      `import * as demo from "${cacheFilepath}"`
    )
  ).toEqual(`import * as demo from "https://example.com/demo/mod.ts"`);

  expect(
    normalizeImportStatement(
      __filename,
      `import * as demo from "${cacheFilepath}";\n\n`
    )
  ).toEqual(`import * as demo from "https://example.com/demo/mod.ts";\n\n`);

  expect(
    normalizeImportStatement(
      __filename,
      `import { example } from "${path
        .relative(__dirname, cacheFilepath)
        .replace(new RegExp(escapeRegExp(path.sep), "g"), path.posix.sep)}"`
    )
  ).toEqual(`import { example } from "https://example.com/demo/mod.ts"`);

  expect(
    normalizeImportStatement(__filename, `import { example } from "./foo";`)
  ).toEqual(`import { example } from "./foo";`);

  expect(
    normalizeImportStatement(__filename, `import { example } from "/foo"`)
  ).toEqual(`import { example } from "/foo"`);

  expect(
    normalizeImportStatement(
      __filename,
      `import { example } from "https://example.com/foo/bar.ts";`
    )
  ).toEqual(`import { example } from "https://example.com/foo/bar.ts";`);
});

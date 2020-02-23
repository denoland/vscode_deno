import * as path from "path";

import { getDenoDeps, Deps } from "./deno_deps";

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
  await expect(getDenoDeps()).resolves.toEqual([
    {
      url: "https://another.example.com/path/mod.ts",
      filepath: path.join(
        denoDepsDir,
        "https",
        "another.example.com",
        "32cd9336a09393d88fc22cf6f95ae006e3f2742a6c461967b2ba7954c5283fbf"
      )
    },
    {
      url: "https://example.com/demo/mod.ts",
      filepath: path.join(
        denoDepsDir,
        "https",
        "example.com",
        "933405cb905c548e870daee56d0589b7dd8e146c0cdbd5f16a959f8227c1fe06"
      )
    },
    {
      url: "https://example.com/demo/sub/mod.ts",
      filepath: path.join(
        denoDepsDir,
        "https",
        "example.com",
        "da88efaa8b70cda7903ddc29b8d4c6ea3015de65329ea393289f4104ae2da941"
      )
    },
    {
      url: "https://example.com/esm/mod.ts",
      filepath: path.join(
        denoDepsDir,
        "https",
        "example.com",
        "8afd52da760dab7f2deda4b7453197f50421f310372c5da3f3847ffd062fa1cf"
      )
    }
  ] as Deps[]);
});

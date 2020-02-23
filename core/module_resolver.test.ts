import * as path from "path";

import { ModuleResolver, ResolvedModule } from "./module_resolver";

const TEST_DIR = path.join(__dirname, "..", "__test__");
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

test("common / module_resolver: resolve module from Deno cache", () => {
  const resolver = ModuleResolver.create(cacheFilepath);

  expect(
    resolver.resolveModules([
      "./sub/mod.ts",
      "/esm/mod.ts",
      "https://example.com/esm/mod.ts"
    ])
  ).toEqual([
    {
      origin: "./sub/mod.ts",
      filepath: path.join(
        path.dirname(cacheFilepath),
        "da88efaa8b70cda7903ddc29b8d4c6ea3015de65329ea393289f4104ae2da941"
      ),
      module: path.join(
        path.dirname(cacheFilepath),
        "da88efaa8b70cda7903ddc29b8d4c6ea3015de65329ea393289f4104ae2da941"
      )
    },
    {
      origin: "/esm/mod.ts",
      filepath: path.join(
        path.dirname(cacheFilepath),
        "8afd52da760dab7f2deda4b7453197f50421f310372c5da3f3847ffd062fa1cf"
      ),
      module: path.join(
        path.dirname(cacheFilepath),
        "8afd52da760dab7f2deda4b7453197f50421f310372c5da3f3847ffd062fa1cf"
      )
    },
    {
      origin: "https://example.com/esm/mod.ts",
      filepath: path.join(
        path.dirname(cacheFilepath),
        "8afd52da760dab7f2deda4b7453197f50421f310372c5da3f3847ffd062fa1cf"
      ),
      module: path.join(
        path.dirname(cacheFilepath),
        "8afd52da760dab7f2deda4b7453197f50421f310372c5da3f3847ffd062fa1cf"
      )
    }
  ] as ResolvedModule[]);
});

test("common / module_resolver: resolve module from local", () => {
  const resolver = ModuleResolver.create(__filename);

  expect(
    resolver.resolveModules([
      "./deno.ts",
      "../package.json",
      "https://example.com/esm/mod.ts"
    ])
  ).toEqual([
    {
      origin: "./deno.ts",
      filepath: path.join(__dirname, "deno.ts"),
      module: path.join(__dirname, "deno.ts").replace(/\.ts$/, "")
    },
    {
      origin: "../package.json",
      filepath: path.join(__dirname, "..", "package.json"),
      module: path.join(__dirname, "..", "package.json")
    },
    {
      origin: "https://example.com/esm/mod.ts",
      filepath: path.join(
        path.dirname(cacheFilepath),
        "8afd52da760dab7f2deda4b7453197f50421f310372c5da3f3847ffd062fa1cf"
      ),
      module: path.join(
        path.dirname(cacheFilepath),
        "8afd52da760dab7f2deda4b7453197f50421f310372c5da3f3847ffd062fa1cf"
      )
    }
  ] as ResolvedModule[]);
});

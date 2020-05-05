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

test("core / module_resolver: resolve module from Deno cache", () => {
  const resolver = ModuleResolver.create(cacheFilepath);

  expect(
    resolver.resolveModules([
      "./sub/mod.ts",
      "/esm/mod.ts",
      "https://example.com/esm/mod.ts",
      "./module_not_exist.ts",
      "https://module.not.exist.com/mod.ts",
    ])
  ).toEqual([
    {
      extension: ".ts",
      origin: "./sub/mod.ts",
      filepath: path.join(
        path.dirname(cacheFilepath),
        "da88efaa8b70cda7903ddc29b8d4c6ea3015de65329ea393289f4104ae2da941"
      ),
    },
    {
      extension: ".ts",
      origin: "/esm/mod.ts",
      filepath: path.join(
        path.dirname(cacheFilepath),
        "8afd52da760dab7f2deda4b7453197f50421f310372c5da3f3847ffd062fa1cf"
      ),
    },
    {
      extension: ".ts",
      origin: "https://example.com/esm/mod.ts",
      filepath: path.join(
        path.dirname(cacheFilepath),
        "8afd52da760dab7f2deda4b7453197f50421f310372c5da3f3847ffd062fa1cf"
      ),
    },
    undefined,
    undefined,
  ] as ResolvedModule[]);
});

test("core / module_resolver: resolve module from local", () => {
  const importMapFile = path.join(TEST_DIR, "import_maps", "import_map.json");

  const resolver = ModuleResolver.create(__filename, importMapFile);

  expect(
    resolver.resolveModules([
      "./deno.ts",
      "../package.json",
      "https://example.com/esm/mod.ts",
      "demo/mod.ts",
      "https://another.example.com/path/mod.ts?foo=bar",
      "./module_not_exist.ts",
      "https://module.not.exist.com/mod.ts",
      "https://example.com/x-typescript-types",
      `file://${path.join(__dirname, "cache.ts")}`,
      `file://./cache.ts`,
      `file://../client/src/extension.ts`,
      `https://unknown_module.com/unknown_module_without_extension`,
    ])
  ).toEqual([
    {
      extension: ".ts",
      origin: "./deno.ts",
      filepath: path.join(__dirname, "deno.ts"),
    },
    undefined,
    {
      extension: ".ts",
      origin: "https://example.com/esm/mod.ts",
      filepath: path.join(
        path.dirname(cacheFilepath),
        "8afd52da760dab7f2deda4b7453197f50421f310372c5da3f3847ffd062fa1cf"
      ),
    },
    {
      extension: ".ts",
      origin: "demo/mod.ts",
      filepath: path.join(
        path.dirname(cacheFilepath),
        "933405cb905c548e870daee56d0589b7dd8e146c0cdbd5f16a959f8227c1fe06"
      ),
    },
    {
      extension: ".ts",
      origin: "https://another.example.com/path/mod.ts?foo=bar",
      filepath: path.join(
        denoDir,
        "deps",
        "https",
        "another.example.com",
        "eac382fbc5e96dcb72874cba87121a37b029ea76f42f0bbd2a56c995759e775e"
      ),
    },
    undefined,
    undefined,
    {
      extension: ".d.ts",
      origin: "https://example.com/x-typescript-types",
      filepath: path.join(
        denoDir,
        "deps",
        "https",
        "example.com",
        "7617203222d94a074bea3e57a893d74af5546f17c1f90760f37f46299faf0cb0"
      ),
    },
    {
      extension: ".ts",
      origin: `file://${path.join(__dirname, "cache.ts")}`,
      filepath: path.join(__dirname, "cache.ts"),
    },
    {
      extension: ".ts",
      origin: "file://./cache.ts",
      filepath: path.join(__dirname, "cache.ts"),
    },
    {
      extension: ".ts",
      origin: "file://../client/src/extension.ts",
      filepath: path.join(__dirname, "..", "client", "src", "extension.ts"),
    },
    undefined,
  ] as ResolvedModule[]);
});

test("core / module_resolver: resolve module if redirect", () => {
  const importMapFile = path.join(TEST_DIR, "import_maps", "import_map.json");

  const resolver = ModuleResolver.create(__filename, importMapFile);

  expect(
    resolver.resolveModules([
      "https://example.com/redirect",
      "https://example.com/redirect_to_absolute",
      "https://example.com/redirect_to_invalid",
      "https://example.com/redirect_to_loop",
    ])
  ).toEqual([
    {
      extension: ".ts",
      origin: "https://example.com/redirect",
      filepath: path.join(
        denoDir,
        "deps",
        "https",
        "another.example.com",
        "32cd9336a09393d88fc22cf6f95ae006e3f2742a6c461967b2ba7954c5283fbf"
      ),
    },
    {
      extension: ".ts",
      origin: "https://example.com/redirect_to_absolute",
      filepath: path.join(
        denoDir,
        "deps",
        "https",
        "example.com",
        "8afd52da760dab7f2deda4b7453197f50421f310372c5da3f3847ffd062fa1cf"
      ),
    },
    undefined,
    undefined,
  ] as ResolvedModule[]);
});

import * as path from "path";

import { CacheModule, DenoCacheModule } from "./deno_cache";

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

test("core / deno_cache", () => {
  const cacheModule = CacheModule.create(cacheFilepath) as DenoCacheModule;

  expect(cacheModule).not.toBe(undefined);

  expect(cacheModule.url.href).toEqual("https://example.com/demo/mod.ts");
  expect(cacheModule.filepath).toEqual(cacheFilepath);

  // resolve sub module
  const subCacheModule = cacheModule.resolveModule(
    "./sub/mod.ts"
  ) as DenoCacheModule;

  expect(subCacheModule).not.toBe(undefined);
  expect(subCacheModule.url.href).toEqual(
    "https://example.com/demo/sub/mod.ts"
  );
  expect(subCacheModule.filepath).toEqual(
    path.join(
      path.dirname(cacheFilepath),
      "da88efaa8b70cda7903ddc29b8d4c6ea3015de65329ea393289f4104ae2da941"
    )
  );

  // resolve esm module
  const esmCacheModule = cacheModule.resolveModule(
    "/esm/mod.ts"
  ) as DenoCacheModule;

  expect(esmCacheModule).not.toBe(undefined);
  expect(esmCacheModule.url.href).toEqual("https://example.com/esm/mod.ts");
  expect(esmCacheModule.filepath).toEqual(
    path.join(
      path.dirname(cacheFilepath),
      "8afd52da760dab7f2deda4b7453197f50421f310372c5da3f3847ffd062fa1cf"
    )
  );

  // resolve remote module
  const remoteCacheModule = cacheModule.resolveModule(
    "https://another.example.com/path/mod.ts"
  ) as DenoCacheModule;

  expect(remoteCacheModule).not.toBe(undefined);
  expect(remoteCacheModule.url.href).toEqual(
    "https://another.example.com/path/mod.ts"
  );
  expect(remoteCacheModule.filepath).toEqual(
    path.join(
      path.dirname(path.dirname(cacheFilepath)),
      "another.example.com",
      "32cd9336a09393d88fc22cf6f95ae006e3f2742a6c461967b2ba7954c5283fbf"
    )
  );
});

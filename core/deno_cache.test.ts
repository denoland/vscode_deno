import * as path from "path";

import { CacheModule, DenoCacheModule } from "./deno_cache";

const TEST_DIR = path.join(__dirname, "..", "tests");
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

  expect(cacheModule.meta.url.href).toEqual("https://example.com/demo/mod.ts");
  expect(cacheModule.filepath).toEqual(cacheFilepath);

  // resolve sub module
  const subCacheModule = cacheModule.resolveModule(
    "./sub/mod.ts"
  ) as DenoCacheModule;

  expect(subCacheModule).not.toBe(undefined);
  expect(subCacheModule.meta.url.href).toEqual(
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
  expect(esmCacheModule.meta.url.href).toEqual(
    "https://example.com/esm/mod.ts"
  );
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
  expect(remoteCacheModule.meta.url.href).toEqual(
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

test("core / deno_cache if filepath not exist in $DENO_DIR", () => {
  const cacheModule = CacheModule.create(
    path.join(__dirname, "not_exist_file")
  );

  expect(cacheModule).toBe(undefined);
});

test("core / deno_cache resolve absolute path module if module not exist", () => {
  const cacheModule = CacheModule.create(cacheFilepath) as DenoCacheModule;

  expect(cacheModule).not.toBe(undefined);

  expect(cacheModule.resolveModule("/path/not/exist")).toBe(undefined);
});

test("core / deno_cache if module exist but metadata file not exist", () => {
  const cacheModule = CacheModule.create(
    // https://invalid.com/invalid
    path.join(
      denoDir,
      "deps",
      "https",
      "invalid.com",
      "70456f90a5c5a173c9d5bc68b36f661a4061b3cb7850e4b9675557a64513deb0"
    )
  ) as DenoCacheModule;

  expect(cacheModule).toBe(undefined);
});

test("core / deno_cache resolve file if target metadata file not exist", () => {
  const cacheModule = CacheModule.create(cacheFilepath) as DenoCacheModule;

  expect(cacheModule).not.toBe(undefined);
  expect(cacheModule.resolveModule("/invalid")).toBe(undefined);
});

test("core / deno_cache resolve a invalid module", () => {
  const cacheModule = CacheModule.create(cacheFilepath) as DenoCacheModule;

  expect(cacheModule).not.toBe(undefined);
  expect(cacheModule.resolveModule("invalid:/@url(dk#!")).toBe(undefined);
});

test("core / deno_cache resolve a redirect module", () => {
  const cacheFilepath = path.join(
    denoDir,
    "deps",
    "https",
    "redirect.com",
    "39bce9e2269e45937f28bc4ff60fb3add9df7e0048078c06dec04c490a90bf9f"
  );

  const cacheModule = CacheModule.create(cacheFilepath) as DenoCacheModule;

  expect(cacheModule).not.toBe(undefined);

  {
    const result = cacheModule.resolveModule("/redirect") as DenoCacheModule;
    expect(result).not.toBe(undefined);

    expect(result.filepath).toBe(
      path.join(
        denoDir,
        "deps",
        "https",
        "redirect.com",
        "6a3cfff3f701f7e3e2611e61d98e9b04ec6a12fe2a72418eb96b929d3836dfd9"
      )
    );
  }

  {
    const result = cacheModule.resolveModule(
      "https://redirect.com/redirect"
    ) as DenoCacheModule;
    expect(result).not.toBe(undefined);

    expect(result.filepath).toBe(
      path.join(
        denoDir,
        "deps",
        "https",
        "redirect.com",
        "6a3cfff3f701f7e3e2611e61d98e9b04ec6a12fe2a72418eb96b929d3836dfd9"
      )
    );
  }

  {
    const result = cacheModule.resolveModule("./redirect") as DenoCacheModule;
    expect(result).not.toBe(undefined);

    expect(result.filepath).toBe(
      path.join(
        denoDir,
        "deps",
        "https",
        "redirect.com",
        "6a3cfff3f701f7e3e2611e61d98e9b04ec6a12fe2a72418eb96b929d3836dfd9"
      )
    );
  }

  {
    const result = cacheModule.resolveModule(
      "/invalid_location"
    ) as DenoCacheModule;
    expect(result).not.toBe(undefined);
  }

  {
    const result = cacheModule.resolveModule("/circle") as DenoCacheModule;
    expect(result).toBe(undefined);
  }

  {
    const result = cacheModule.resolveModule(
      "/full_url_redirect"
    ) as DenoCacheModule;
    expect(result.filepath).toBe(
      path.join(
        denoDir,
        "deps",
        "https",
        "redirect.com",
        "6a3cfff3f701f7e3e2611e61d98e9b04ec6a12fe2a72418eb96b929d3836dfd9"
      )
    );
    expect(result.meta.url.href).toBe("https://redirect.com/result");
  }

  {
    const result = cacheModule.resolveModule(
      "/redirect_to_relative"
    ) as DenoCacheModule;
    expect(result.filepath).toBe(
      path.join(
        denoDir,
        "deps",
        "https",
        "redirect.com",
        "0278046a318a368d7a8da89fdf59c60892dbf3498b996b36f11faf7d74d141c8"
      )
    );
    expect(result.meta.url.href).toBe(
      "https://redirect.com/redirect_to_relative"
    );
  }
});

test("core / deno_cache resolve a module which have set a x-typescript-types header", () => {
  const cacheFilepath = path.join(
    denoDir,
    "deps",
    "https",
    "redirect.com",
    "39bce9e2269e45937f28bc4ff60fb3add9df7e0048078c06dec04c490a90bf9f"
  );

  const cacheModule = CacheModule.create(cacheFilepath) as DenoCacheModule;

  expect(cacheModule).not.toBe(undefined);

  {
    const result = cacheModule.resolveModule(
      "/redirect-by-x-typescript-types"
    ) as DenoCacheModule;
    expect(result).not.toBe(undefined);

    expect(result.filepath).toBe(
      path.join(
        denoDir,
        "deps",
        "https",
        "redirect.com",
        "6a3cfff3f701f7e3e2611e61d98e9b04ec6a12fe2a72418eb96b929d3836dfd9"
      )
    );
  }
});

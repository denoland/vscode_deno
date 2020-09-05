import {
  listVersionsOfMod,
  modTreeOf,
  parseImportStatement,
  ModTree,
} from "./import_enhanced";

import { PermCache } from "./permcache";

test("core / import_enhance: listVersionsOfMod", async () => {
  const result = await listVersionsOfMod("std");
  expect(result.latest).toBeTruthy();
  expect(result.versions.length).not.toEqual(0);
});

test("core / import_enhance: modTreeOf", async () => {
  const cache = await PermCache.create<Record<string, ModTree>>(
    "import_enhance-test",
    undefined
  );
  await cache.destroy_cache();
  const result = await modTreeOf(cache, "std");
  expect(result.uploaded_at).toBeTruthy();
  expect(result.directory_listing.length).not.toEqual(0);
  await cache.destroy_cache();
});

test("core / import_enhance: parseImportStatement", async () => {
  const test_cases = [
    {
      imp: "import * from 'http://a.c/xx/a.ts'",
      expect: {
        domain: "a.c",
        module: "xx",
        version: "latest",
        path: "/a.ts",
      },
    },
    {
      imp: "import * from 'http://deno.land/std@0.66.0/fs/copy.ts'",
      expect: {
        domain: "deno.land",
        module: "std",
        version: "0.66.0",
        path: "/fs/copy.ts",
      },
    },
    {
      imp: "import * from 'https://deno.land/x/sha2@1.0.0/mod/sha224.ts'",
      expect: {
        domain: "deno.land",
        module: "sha2",
        version: "1.0.0",
        path: "/mod/sha224.ts",
      },
    },
    {
      imp: "import {} from 'https://deno.land/std@/';",
      expect: {
        domain: "deno.land",
        module: "std",
        version: "latest",
        path: "/",
      },
    },
    // non semver verions
    {
      imp: "import {} from 'https://deno.land/std@1.0.0-alpha/';",
      expect: {
        domain: "deno.land",
        module: "std",
        version: "1.0.0-alpha",
        path: "/",
      },
    },
    {
      imp: "import {} from 'https://deno.land/std@v1/';",
      expect: {
        domain: "deno.land",
        module: "std",
        version: "v1",
        path: "/",
      },
    },
    {
      imp: "import {} from 'https://deno.land/x/@/';",
      expect: {
        domain: "deno.land",
        module: "",
        version: "latest",
        path: "/",
      },
    },
    {
      imp: "import { } from 'https://deno.land/x/sq'",
      expect: {
        domain: "deno.land",
        module: "sq",
        version: "latest",
        path: "/",
      },
    },
  ] as {
    imp: string;
    expect: { domain: string; module: string; version: string; path: string };
  }[];

  for (const test_case of test_cases) {
    const result = parseImportStatement(test_case.imp);
    expect(result?.domain).toEqual(test_case.expect.domain);
    expect(result?.module).toEqual(test_case.expect.module);
    expect(result?.version).toEqual(test_case.expect.version);
    expect(result?.path).toEqual(test_case.expect.path);
  }
});

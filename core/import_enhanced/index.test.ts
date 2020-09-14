import { VERSION_REG, parseImportStatement } from "./index";

test("core / import_enhance: test VERSION_REG", async () => {
  const test_cases: { text: string; result: boolean }[] = [
    { text: "1.0.0", result: true },
    { text: "1.0.0@", result: false },
    { text: "1.0.0嗯？", result: false },
    { text: "1.0.0-alpha", result: true },
    { text: "1.0.0-beta_1", result: true },
    { text: "v1", result: true },
    { text: "v1/", result: false },
    { text: "/v1", result: false },
  ];

  for (const test_case of test_cases) {
    expect(VERSION_REG.test(test_case.text)).toEqual(test_case.result);
  }
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
    {
      imp: "import type {} from 'https://deno.land/std@/';",
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

    {
      imp: "export * from 'http://a.c/xx/a.ts'",
      expect: {
        domain: "a.c",
        module: "xx",
        version: "latest",
        path: "/a.ts",
      },
    },
    {
      imp: "export * from 'http://deno.land/std@0.66.0/fs/copy.ts'",
      expect: {
        domain: "deno.land",
        module: "std",
        version: "0.66.0",
        path: "/fs/copy.ts",
      },
    },
    {
      imp: "export * from 'https://deno.land/x/sha2@1.0.0/mod/sha224.ts'",
      expect: {
        domain: "deno.land",
        module: "sha2",
        version: "1.0.0",
        path: "/mod/sha224.ts",
      },
    },
    {
      imp: "export type {} from 'https://deno.land/std@/';",
      expect: {
        domain: "deno.land",
        module: "std",
        version: "latest",
        path: "/",
      },
    },
    {
      imp: "export {} from 'https://deno.land/std@/';",
      expect: {
        domain: "deno.land",
        module: "std",
        version: "latest",
        path: "/",
      },
    },
    // non semver verions
    {
      imp: "export {} from 'https://deno.land/std@1.0.0-alpha/';",
      expect: {
        domain: "deno.land",
        module: "std",
        version: "1.0.0-alpha",
        path: "/",
      },
    },
    {
      imp: "export {} from 'https://deno.land/std@v1/';",
      expect: {
        domain: "deno.land",
        module: "std",
        version: "v1",
        path: "/",
      },
    },
    {
      imp: "export {} from 'https://deno.land/x/@/';",
      expect: {
        domain: "deno.land",
        module: "",
        version: "latest",
        path: "/",
      },
    },
    {
      imp: "export { } from 'https://deno.land/x/sq'",
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

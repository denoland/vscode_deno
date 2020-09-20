import {
  buildCompletionListURL,
  fetchCompletionList,
  fetchWellKnown,
  getWellKnown,
  parseReplacementVariablesFromURL,
  parseURLFromImportStatement,
  validateWellKnown,
} from "./import_intellisense";
import { getVSCodeDenoDir } from "./diskcache";
import http from "http";
import express from "express";
import { promises as fsp } from "fs";
import { join } from "path";

let server1: http.Server;
let server2: http.Server;

beforeAll(() => {
  const app = express();
  app.use(express.static("./core/testdata/import_intellisense/test_registry"));
  server1 = http.createServer(app).listen(8888);
  server2 = http.createServer(express()).listen(8889);
});

afterAll(() => {
  server1.close();
  server2.close();
});

test("parse url from import statement", () => {
  const testcases = [
    [
      `import {} from "https://deno.land/std@0.69.0/version.ts";\n`,
      ["https://deno.land/std@0.69.0/version.ts", 16],
    ],
    [
      `import "https://deno.land/std@0.69.0/version.ts";\n`,
      ["https://deno.land/std@0.69.0/version.ts", 8],
    ],
    [
      `import x from "https://deno.land/std@0.69.0/version.ts";\n`,
      ["https://deno.land/std@0.69.0/version.ts", 15],
    ],
    [
      `export {} from "https://deno.land/std@0.69.0/version.ts";\n`,
      ["https://deno.land/std@0.69.0/version.ts", 16],
    ],
    [
      `export "https://deno.land/std@0.69.0/version.ts";\n`,
      ["https://deno.land/std@0.69.0/version.ts", 8],
    ],
    [
      `export x from "https://deno.land/std@0.69.0/version.ts";\n`,
      ["https://deno.land/std@0.69.0/version.ts", 15],
    ],
    [
      `import type {} from "https://deno.land/std@0.69.0/version.ts";\n`,
      ["https://deno.land/std@0.69.0/version.ts", 21],
    ],
    [
      `import type "https://deno.land/std@0.69.0/version.ts";\n`,
      ["https://deno.land/std@0.69.0/version.ts", 13],
    ],
    [
      `import type x from "https://deno.land/std@0.69.0/version.ts";\n`,
      ["https://deno.land/std@0.69.0/version.ts", 20],
    ],
    [
      `export type {} from "https://deno.land/std@0.69.0/version.ts";\n`,
      ["https://deno.land/std@0.69.0/version.ts", 21],
    ],
    [
      `export type "https://deno.land/std@0.69.0/version.ts";\n`,
      ["https://deno.land/std@0.69.0/version.ts", 13],
    ],
    [
      `export type x from "https://deno.land/std@0.69.0/version.ts";\n`,
      ["https://deno.land/std@0.69.0/version.ts", 20],
    ],
    [
      `import {} from 'https://deno.land/std@0.69.0/version.ts';\n`,
      ["https://deno.land/std@0.69.0/version.ts", 16],
    ],
    [`import {} from '';\n`, undefined],
    [`import {} from 'asd';\n`, undefined],
    [`import {} from 'http:///';\n`, undefined],
  ] as const;

  for (const testcase of testcases) {
    expect(parseURLFromImportStatement(testcase[0])).toEqual(
      testcase[1] ? [new URL(testcase[1][0]), testcase[1][1]] : testcase[1]
    );
  }
});

test("parse replacement variables from url", () => {
  const testcases = [
    ["https://api.deno.land/modules?short=1", []],
    ["https://deno.land/_vsc1/modules/${module}", ["module"]],
    [
      "https://deno.land/_vsc1/modules/${module}/v/${{version}}",
      ["module", "version"],
    ],
    ["https://deno.land/_vsc1/modules/{module}/v/{{version}}", []],
  ] as const;

  for (const testcase of testcases) {
    expect(parseReplacementVariablesFromURL(testcase[0])).toEqual(testcase[1]);
  }
});

test("simple validations for welllknown", async () => {
  await expect(validateWellKnown({ version: 1 })).rejects.toThrowError(
    "registries must be defined"
  );
  await expect(validateWellKnown({ version: 2 })).rejects.toThrowError(
    "version must be one of the following values: 1"
  );
  const good1 = { version: 1, registries: [] };
  await expect(validateWellKnown(good1)).resolves.toEqual(good1);
  await expect(
    validateWellKnown({
      version: 1,
      registries: [{ schema: "/:module@:version/:path*" }],
    })
  ).rejects.toThrowError("registries[0].variables must be defined");
  await expect(
    validateWellKnown({
      version: 1,
      registries: [{ schema: "/:module@:version/:path*" }],
    })
  ).rejects.toThrowError("registries[0].variables must be defined");
});

test("advanced validations for wellknown", async () => {
  await expect(
    validateWellKnown({
      version: 1,
      registries: [
        {
          schema: "/:module@:version/:path*",
          variables: [
            { key: "module", url: "https://api.deno.land/modules?short" },
            { key: "version", url: "https://deno.land/_vsc1/module/${module}" },
          ],
        },
      ],
    })
  ).rejects.toThrowError(
    "ValidationError: registry with schema '/:module@:version/:path*' is missing variable declaration for 'path'"
  );

  await expect(
    validateWellKnown({
      version: 1,
      registries: [
        {
          schema: "/:module@:version/:path*",
          variables: [
            { key: "module", url: "https://api.deno.land/modules?short" },
            {
              key: "version",
              url: "https://deno.land/_vsc1/module/${module}/${path}",
            },
            {
              key: "path",
              url: "https://deno.land/_vsc1/module/${module}/v/${{version}}",
            },
          ],
        },
      ],
    })
  ).rejects.toThrowError(
    "ValidationError: url 'https://deno.land/_vsc1/module/${module}/${path}' (for variable 'version' in registry with schema '/:module@:version/:path*') uses variable 'path', but this is not possible because the schema defines 'path' to the right of 'version'"
  );

  await expect(
    validateWellKnown({
      version: 1,
      registries: [
        {
          schema: "/:module@:version/:path*",
          variables: [
            { key: "module", url: "https://api.deno.land/modules?short" },
            {
              key: "version",
              url: "https://deno.land/_vsc1/module/${module}/v/${{version}}",
            },
            {
              key: "path",
              url: "https://deno.land/_vsc1/module/${module}/v/${{version}}",
            },
          ],
        },
      ],
    })
  ).rejects.toThrowError(
    "ValidationError: url 'https://deno.land/_vsc1/module/${module}/v/${{version}}' (for variable 'version' in registry with schema '/:module@:version/:path*') uses variable 'version', which is not allowed because that would be a self reference"
  );

  await expect(
    validateWellKnown({
      version: 1,
      registries: [
        {
          schema: "/:module@version/:path*",
          variables: [
            { key: "module", url: "https://api.deno.land/modules?short" },
            {
              key: "version",
              url: "https://deno.land/_vsc1/module/${module}/v/${{version}}",
            },
            {
              key: "path",
              url: "https://deno.land/_vsc1/module/${module}/v/${{version}}",
            },
          ],
        },
      ],
    })
  ).rejects.toThrowError(
    "ValidationError: registry with schema '/:module@version/:path*' is missing a path parameter in schema for variable 'version'"
  );

  const good2 = {
    version: 1,
    registries: [
      {
        schema: "/:module@:version/:path*",
        variables: [
          { key: "module", url: "https://api.deno.land/modules?short" },
          { key: "version", url: "https://deno.land/_vsc1/module/${module}" },
          {
            key: "path",
            url: "https://deno.land/_vsc1/module/${module}/v/${{version}}",
          },
        ],
      },
    ],
  };
  await expect(validateWellKnown(good2)).resolves.toEqual(good2);
});

test("fetch wellknown", async () => {
  await expect(fetchWellKnown("http://localhost:8888")).resolves.toEqual(
    JSON.parse(
      await fsp.readFile(
        "./core/testdata/import_intellisense/test_registry/.well-known/deno-import-intellisense.json",
        { encoding: "utf8" }
      )
    )
  );
  await expect(fetchWellKnown("http://localhost:8889")).rejects.toThrowError(
    "Response code 404"
  );
  const dir = getVSCodeDenoDir();
  try {
    await fsp.rmdir(dir, { recursive: true });
    await fsp.mkdir(join(dir, "import_intellisense_wellknown"), {
      recursive: true,
    });
    await fsp.mkdir(join(dir, "import_intellisense_completions"), {
      recursive: true,
    });
  } catch {
    /* ignore */
  }
  await expect(getWellKnown("http://localhost:8888")).resolves.toEqual(
    JSON.parse(
      await fsp.readFile(
        "./core/testdata/import_intellisense/test_registry/.well-known/deno-import-intellisense.json",
        { encoding: "utf8" }
      )
    )
  );
  await expect(getWellKnown("http://localhost:8888")).resolves.toEqual(
    JSON.parse(
      await fsp.readFile(
        "./core/testdata/import_intellisense/test_registry/.well-known/deno-import-intellisense.json",
        { encoding: "utf8" }
      )
    )
  );
});

test("build completion list url", () => {
  expect(
    buildCompletionListURL("https://deno.land/_vsc1/modules/${module}", {
      module: "ltest",
    })
  ).toEqual("https://deno.land/_vsc1/modules/ltest");
  expect(
    buildCompletionListURL(
      "https://deno.land/_vsc1/modules/${module}/v/${version}",
      {
        module: "ltest",
        version: "1.0.0",
      }
    )
  ).toEqual("https://deno.land/_vsc1/modules/ltest/v/1.0.0");
  expect(
    buildCompletionListURL(
      "https://deno.land/_vsc1/modules/${module}/v/${{version}}",
      {
        module: "ltest",
        version: "std/1.0.0",
      }
    )
  ).toEqual("https://deno.land/_vsc1/modules/ltest/v/std%2F1.0.0");
});

test("fetch completions list", async () => {
  await expect(
    fetchCompletionList("http://localhost:8888/api/modules.json", {})
  ).resolves.toEqual(["sqs", "s3", "ssm"]);
  await expect(
    fetchCompletionList("http://localhost:8888/api/modules/${module}.json", {
      module: "sqs",
    })
  ).resolves.toEqual(["0.1.1", "0.1.0"]);
  await expect(
    fetchCompletionList(
      "http://localhost:8888/api/versions/${module}/${{version}}.json",
      {
        module: "sqs",
        version: "0.1.0",
      }
    )
  ).resolves.toEqual(["mod.tsx", "src/app.ts", "deps.ts", "src/vendor/pkg.js"]);
});

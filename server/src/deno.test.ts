import * as path from "path";

import { deno, Deps, DenoModule } from "./deno";
import { ImportMap } from "./import_map";

const TEST_DIR = path.join(__dirname, "__test__");

beforeAll(async () => {
  await deno.init();
});

test("server / deno / DENO_DIR", () => {
  expect(deno.DENO_DIR).toBeTruthy();
  expect(deno.DENO_DEPS_DIR).toBeTruthy();
  expect(deno.DTS_FILE).toContain(deno.DENO_DIR);
});

test("server / deno / init", async () => {
  expect(deno.executablePath).not.toBe(undefined);
});

test("server / deno / getVersion()", async () => {
  await expect(deno.version).not.toEqual(undefined);
});

test("server / deno / getTypes()", async () => {
  await expect(deno.getTypes.bind(deno)).not.toThrowError();
});

// test("server / deno / format()", async () => {
//   const code = `console.log( 123 )`;
//   await expect(deno.format(code, { cwd: __dirname })).resolves.toEqual(
//     `console.log(123);\n`
//   );
// });

test("server / deno / _filepath2url()", async () => {
  const mockDenoModuleFilepath = path.join(
    deno.DENO_DEPS_DIR,
    "https",
    "example.com",
    "demo",
    "mod.ts"
  );

  expect(deno._filepath2url(mockDenoModuleFilepath)).toEqual(
    "https://example.com/demo/mod.ts"
  );
});

test("server / deno / getDependencies()", async () => {
  const mockDenoDepsDir = path.join(TEST_DIR, "deno_dir", "deps");

  const mockFilepath = path.join(
    mockDenoDepsDir,
    "https",
    "example.com",
    "demo",
    "mod.ts"
  );

  await expect(
    deno.getDependencies(mockDenoDepsDir, [], mockDenoDepsDir)
  ).resolves.toEqual([
    {
      filepath: mockFilepath,
      url: "https://example.com/demo/mod.ts"
    }
  ] as Deps[]);
});

test("server / deno / _resolveModuleFromImportMap()", async () => {
  const mockWorkspaceDir = path.join(TEST_DIR, "import_maps");

  const validImportMapFilepath = path.join(mockWorkspaceDir, "import_map.json");

  const importMaps = await ImportMap.create(
    mockWorkspaceDir,
    validImportMapFilepath
  );

  expect(deno._resolveModuleFromImportMap(importMaps, "./example")).toEqual(
    "./example"
  );

  expect(deno._resolveModuleFromImportMap(importMaps, "./example.ts")).toEqual(
    "./example.ts"
  );

  expect(deno._resolveModuleFromImportMap(importMaps, "http/mod.ts")).toEqual(
    "http/mod.ts"
  );

  expect(deno._resolveModuleFromImportMap(importMaps, "demo/mod.ts")).toEqual(
    "https://example.com/demo/mod.ts"
  );

  expect(
    deno._resolveModuleFromImportMap(importMaps, "demo/server.ts")
  ).toEqual("https://example.com/demo/server.ts");

  expect(
    deno._resolveModuleFromImportMap(importMaps, "demo/testing/assert.ts")
  ).toEqual("https://example.com/demo/testing/assert.ts");
});

test("server / deno / resolveModule()", async () => {
  const mockWorkspaceDir = path.join(TEST_DIR, "import_maps");
  const mockDenoDepsDir = path.join(TEST_DIR, "deno_dir", "deps");

  const validImportMapFilepath = path.join(mockWorkspaceDir, "import_map.json");

  const importMaps = await ImportMap.create(
    mockWorkspaceDir,
    validImportMapFilepath
  );

  await expect(
    deno.resolveModule(importMaps, __dirname, "./example.ts", mockDenoDepsDir)
  ).resolves.toEqual({
    filepath: path.join(__dirname, "example.ts"),
    raw: "./example.ts",
    remote: false
  } as DenoModule);

  await expect(
    deno.resolveModule(importMaps, __dirname, "demo/mod.ts", mockDenoDepsDir)
  ).resolves.toEqual({
    filepath: path.join(
      mockDenoDepsDir,
      "https",
      "example.com",
      "demo",
      "mod.ts"
    ),
    raw: "demo/mod.ts",
    remote: true
  } as DenoModule);

  await expect(
    deno.resolveModule(
      { imports: {} },
      __dirname,
      "https://example.com/demo/mod.ts",
      mockDenoDepsDir
    )
  ).resolves.toEqual({
    filepath: path.join(
      mockDenoDepsDir,
      "https",
      "example.com",
      "demo",
      "mod.ts"
    ),
    raw: "https://example.com/demo/mod.ts",
    remote: true
  } as DenoModule);
});

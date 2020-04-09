import * as path from "path";

import { ImportMap } from "./import_map";

const TEST_DIR = path.join(__dirname, "..", "__test__");

test("core / import_map", async () => {
  const mockWorkspaceDir = path.join(TEST_DIR, "import_maps");

  const validImportMapFilepath = path.join(mockWorkspaceDir, "import_map.json");

  expect(ImportMap.create(validImportMapFilepath).toJSON()).toEqual({
    "demo/": "https://example.com/demo/",
    core: "./src/relative/path/to",
  });

  expect(
    ImportMap.create(validImportMapFilepath).resolveModule("demo/mod.ts")
  ).toEqual("https://example.com/demo/mod.ts");

  expect(
    ImportMap.create(validImportMapFilepath).resolveModule("demo1/mod.ts")
  ).toEqual("demo1/mod.ts");

  expect(
    ImportMap.create(validImportMapFilepath).resolveModule("core/mod.ts")
  ).toEqual(
    path.join(mockWorkspaceDir, "src", "relative", "path", "to", "mod.ts")
  );

  const importMap = await ImportMap.create(validImportMapFilepath);

  for (const [prefix, moduleName] of importMap) {
    expect(typeof prefix).toBe("string");
    expect(typeof moduleName).toBe("string");
    expect(prefix).not.toEqual(moduleName);
  }
});

test("core / import_map if import_map file not exist", async () => {
  expect(
    ImportMap.create(path.join(__dirname, "path", "not", "exist")).toJSON()
  ).toEqual({});
});

test("core / import_map if invalid import_map", async () => {
  const mockWorkspaceDir = path.join(TEST_DIR, "import_maps");

  const filepath = path.join(mockWorkspaceDir, "invalid.json");

  const importMap = ImportMap.create(filepath);

  expect(importMap.toJSON()).toEqual({});
});

test("core / import_map if it is empty", async () => {
  const mockWorkspaceDir = path.join(TEST_DIR, "import_maps");

  const filepath = path.join(mockWorkspaceDir, "empty_import_map.json");

  const importMap = ImportMap.create(filepath);

  expect(importMap.toJSON()).toEqual({});
});

test("core / import_map if imports field not an Object", async () => {
  const mockWorkspaceDir = path.join(TEST_DIR, "import_maps");

  const filepath = path.join(
    mockWorkspaceDir,
    "import_map_not_valid_field.json"
  );

  const importMap = ImportMap.create(filepath);

  expect(importMap.toJSON()).toEqual({});
});

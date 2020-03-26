import * as path from "path";

import { ImportMap } from "./import_map";

const TEST_DIR = path.join(__dirname, "..", "__test__");

test("core / import_map", async () => {
  const mockWorkspaceDir = path.join(TEST_DIR, "import_maps");

  const invalidImportMapFilepath = path.join(mockWorkspaceDir, "invalid.json");
  const validImportMapFilepath = path.join(mockWorkspaceDir, "import_map.json");

  expect(ImportMap.create(validImportMapFilepath).toJSON()).toEqual({
    "demo/": "https://example.com/demo/",
  });

  expect(
    ImportMap.create(validImportMapFilepath).resolveModule("demo/mod.ts")
  ).toEqual("https://example.com/demo/mod.ts");

  expect(
    ImportMap.create(validImportMapFilepath).resolveModule("demo1/mod.ts")
  ).toEqual("demo1/mod.ts");

  expect(ImportMap.create(invalidImportMapFilepath).toJSON()).toEqual({});

  const importMap = await ImportMap.create(validImportMapFilepath);

  for (const [prefix, moduleName] of importMap) {
    expect(typeof prefix).toBe("string");
    expect(typeof moduleName).toBe("string");
    expect(prefix).not.toEqual(moduleName);
  }

  // if import_map not exist
  expect(
    ImportMap.create(path.join(__dirname, "path", "not", "exist")).toJSON()
  ).toEqual({});
});

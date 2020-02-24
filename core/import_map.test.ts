import * as path from "path";

import { ImportMap, ImportContent } from "./import_map";

const TEST_DIR = path.join(__dirname, "..", "__test__");

test("core / import_map", async () => {
  const mockWorkspaceDir = path.join(TEST_DIR, "import_maps");

  const invalidImportMapFilepath = path.join(mockWorkspaceDir, "invalid.json");
  const validImportMapFilepath = path.join(mockWorkspaceDir, "import_map.json");

  expect((await ImportMap.create(validImportMapFilepath)).toJSON()).toEqual({
    "demo/": "https://example.com/demo/"
  } as ImportContent);

  expect(
    (await ImportMap.create(validImportMapFilepath)).resolveModule(
      "demo/mod.ts"
    )
  ).toEqual("https://example.com/demo/mod.ts");

  expect(
    (await ImportMap.create(validImportMapFilepath)).resolveModule(
      "demo1/mod.ts"
    )
  ).toEqual("demo1/mod.ts");

  expect((await ImportMap.create(invalidImportMapFilepath)).toJSON()).toEqual(
    {} as ImportContent
  );
});

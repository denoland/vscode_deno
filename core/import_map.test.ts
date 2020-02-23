import * as path from "path";

import { ImportMap, IImportMaps } from "./import_map";

const TEST_DIR = path.join(__dirname, "..", "__test__");

test("common / import_map / ImportMap.create()", () => {
  const mockWorkspaceDir = path.join(TEST_DIR, "import_maps");

  const invalidImportMapFilepath = path.join(mockWorkspaceDir, "invalid.json");
  const validImportMapFilepath = path.join(mockWorkspaceDir, "import_map.json");

  expect(ImportMap.create(validImportMapFilepath)).resolves.toEqual({
    imports: {
      "demo/": "https://example.com/demo/"
    }
  } as IImportMaps);

  expect(ImportMap.create(invalidImportMapFilepath)).resolves.toEqual({
    imports: {}
  } as IImportMaps);
});

import * as path from "path";

import { ImportMap, IImportMaps } from "./import_map";

const TEST_DIR = path.join(__dirname, "..", "__test__");

test("common / import_map / ImportMap.create()", () => {
  const mockWorkspaceDir = path.join(TEST_DIR, "import_maps");

  const validImportMapFilepath = path.join(mockWorkspaceDir, "import_map.json");

  expect(
    ImportMap.create(mockWorkspaceDir, validImportMapFilepath)
  ).resolves.toEqual({
    imports: {
      "demo/": "https://example.com/demo/"
    }
  } as IImportMaps);

  expect(
    ImportMap.create(mockWorkspaceDir, "./import_map.json")
  ).resolves.toEqual({
    imports: {
      "demo/": "https://example.com/demo/"
    }
  } as IImportMaps);

  expect(
    ImportMap.create(mockWorkspaceDir, "./not_exist.json")
  ).resolves.toEqual({
    imports: {}
  } as IImportMaps);

  expect(ImportMap.create(mockWorkspaceDir, "./invalid.json")).resolves.toEqual(
    {
      imports: {}
    } as IImportMaps
  );
});

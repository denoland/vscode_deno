import * as path from "path";

import {
  readConfigurationFromVscodeSettings,
  DenoPluginConfig
} from "./vscode_settings";

const TEST_DIR = path.join(__dirname, "..", "__test__");

test("core / vscode_settings", async () => {
  const vscodeDir = path.join(TEST_DIR, "vscode_settings");
  const config = readConfigurationFromVscodeSettings(vscodeDir);

  expect(config).toEqual({
    enable: true,
    dts_file: ["./demo.d.ts"],
    import_map: undefined
  } as DenoPluginConfig);

  expect(readConfigurationFromVscodeSettings("./file/not/exist")).toEqual(
    undefined
  );
});

test("core / vscode_settings if it empty", async () => {
  const vscodeDir = path.join(TEST_DIR, "vscode_settings_1");
  const config = readConfigurationFromVscodeSettings(vscodeDir);

  expect(config).toEqual({
    enable: false,
    dts_file: [],
    import_map: undefined
  } as DenoPluginConfig);
});

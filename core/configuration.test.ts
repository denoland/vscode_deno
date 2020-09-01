import * as path from "path";

import { Configuration, ConfigurationField } from "./configuration";

const TEST_DIR = path.join(__dirname, "testdata");

test("core / configuration / resolveFromVscode if it is a valid file", async () => {
  const vscodeDir = path.join(TEST_DIR, "vscode_settings_valid");

  const configManager = new Configuration();

  configManager.resolveFromVscode(vscodeDir);

  expect(configManager.config).toEqual({
    enable: true,
    unstable: true,
    import_map: "./import_map.json",
    executable_path: "/bin/deno",
    custom_deno_dir: "/cache/deno",
  } as ConfigurationField);
});

test("core / configuration / resolveFromVscode if valid section", async () => {
  const vscodeDir = path.join(TEST_DIR, "vscode_settings_valid_section");

  const configManager = new Configuration();

  configManager.resolveFromVscode(vscodeDir);

  expect(configManager.config).toEqual({
    enable: true,
    unstable: false,
    import_map: null,
    executable_path: null,
    custom_deno_dir: null,
  } as ConfigurationField);
});

test("core / configuration / resolveFromVscode if config file not exist", async () => {
  const configManager = new Configuration();

  configManager.resolveFromVscode("./file/not/exist");

  expect(configManager.config).toEqual(Configuration.defaultConfiguration);
});

test("core / configuration / resolveFromVscode if config file is empty", async () => {
  const vscodeDir = path.join(TEST_DIR, "vscode_settings_empty");

  const configManager = new Configuration();

  configManager.resolveFromVscode(vscodeDir);

  expect(configManager.config).toEqual({
    enable: false,
    unstable: false,
    import_map: null,
    executable_path: null,
    custom_deno_dir: null,
  } as ConfigurationField);
});

test("core / configuration / resolveFromVscode if field is invalid", async () => {
  const vscodeDir = path.join(TEST_DIR, "vscode_settings_invalid_field");

  const configManager = new Configuration();

  configManager.resolveFromVscode(vscodeDir);

  expect(configManager.config).toEqual({
    enable: true,
    unstable: true,
    import_map: "1,2,3",
    executable_path: "1,2,3",
    custom_deno_dir: "1,2,3",
  } as ConfigurationField);
});

test("core / configuration / update", async () => {
  const configManager = new Configuration();

  let hasTriggerListener = false;

  expect(configManager.config).toEqual(Configuration.defaultConfiguration);

  configManager.onUpdatedConfig(() => {
    hasTriggerListener = true;
  });

  configManager.update({ enable: true });

  expect(hasTriggerListener).toBe(true);

  expect(configManager.config).toEqual({
    enable: true,
    unstable: false,
    import_map: null,
    executable_path: null,
    custom_deno_dir: null,
  } as ConfigurationField);
});

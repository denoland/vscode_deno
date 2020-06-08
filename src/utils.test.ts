import path from "path";
import { URL } from "url";

import {
  pathExistsSync,
  escapeRegExp,
  isHttpURL,
  hashURL,
  normalizeFilepath,
  isValidDenoDocument,
  isUntitledDocument,
  getDenoDir,
  getDenoDepsDir,
  getPluginPath,
  getDenoDtsPath,
  isInDenoDir,
} from "./utils";

describe("pathExistsSync", () => {
  test("pathExistsSync not exist", () => {
    expect(pathExistsSync("./path_not_exist")).toBe(false);
  });
  test("pathExistsSync exist", () => {
    expect(pathExistsSync(__filename)).toBe(true);
  });
});

test("escapeRegExp", () => {
  expect(escapeRegExp("/User/demo/file/path")).toEqual("/User/demo/file/path");

  expect(
    escapeRegExp("C:\\Users\\runneradmin\\AppData\\Local\\deno\\deps\\"),
  ).toEqual(
    "C:\\\\Users\\\\runneradmin\\\\AppData\\\\Local\\\\deno\\\\deps\\\\",
  );
});

test("isHttpURL", () => {
  expect(isHttpURL("/User/demo/file/path")).toBeFalsy();
  expect(isHttpURL("https")).toBeFalsy();
  expect(isHttpURL("https://")).toBeFalsy();
  expect(isHttpURL("https://example")).toBeTruthy();
  expect(isHttpURL("https://example.com")).toBeTruthy();
  expect(isHttpURL("https://**@!)($LFKASD><MASD}{][\\")).toBeFalsy();
});

test("hashURL", () => {
  // example from __test_ folder
  expect(hashURL(new URL("https://example.com/esm/mod.ts"))).toEqual(
    "8afd52da760dab7f2deda4b7453197f50421f310372c5da3f3847ffd062fa1cf",
  );
});

test("normalizeFilepath", () => {
  if (process.platform === "win32") {
    expect(normalizeFilepath("/path/to/file")).toEqual("\\path\\to\\file");
  } else {
    expect(normalizeFilepath("/path/to/file")).toEqual("/path/to/file");
  }

  expect(normalizeFilepath("d:\\path\\to\\file")).toEqual("D:\\path\\to\\file");
});

test("isValidDenoDocument", () => {
  expect(isValidDenoDocument("foo")).toBe(false);
  expect(isValidDenoDocument("bar")).toBe(false);
  expect(isValidDenoDocument("javascript")).toBe(true);
  expect(isValidDenoDocument("javascriptreact")).toBe(true);
  expect(isValidDenoDocument("typescript")).toBe(true);
  expect(isValidDenoDocument("typescriptreact")).toBe(true);
});

test("isUntitledDocument", () => {
  expect(isUntitledDocument("foo")).toBe(false);
  expect(isUntitledDocument("./foo")).toBe(false);
  expect(isUntitledDocument("../bar")).toBe(false);
  expect(isUntitledDocument("untitled: ")).toBe(true);
});

test("getDenoDir", () => {
  expect(getDenoDir()).not.toBe(undefined);
});

test("getDenoDepsDir", () => {
  expect(getDenoDepsDir()).not.toBe(undefined);
});

test("getPluginPath", () => {
  expect(getPluginPath()).not.toBe(undefined);
});

test("DenoDir includes DepsDir", () => {
  expect(getDenoDepsDir()).toContain(getDenoDir());
});

test("isInDenoDir", () => {
  const modPath = path.join(getDenoDir(), "https", "example.com", "/mod.ts");
  expect(isInDenoDir(modPath)).toBe(true);
  expect(isInDenoDir("/a/path/to/somewhere")).toBe(false);
});

test("getDenoDtsPath", () => {
  expect(
    [
      path.join(getPluginPath(), "lib.deno.d.ts"),
      path.join(getDenoDir(), "lib.deno.d.ts"),
    ],
  ).toContain(getDenoDtsPath("lib.deno.d.ts"));
  expect(
    [
      path.join(getPluginPath(), "lib.webworker.d.ts"),
      path.join(getDenoDir(), "lib.webworker.d.ts"),
    ],
  ).toContain(getDenoDtsPath("lib.webworker.d.ts"));
});

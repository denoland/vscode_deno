import {
  pathExists,
  pathExistsSync,
  toAbsolutePath,
  escapeRegExp,
  isHttpURL,
  hashURL,
  normalizeFilepath,
  isValidDenoDocument,
  isUntitledDocument,
  findNonExtensionModule,
  isSetAndNotEmptyString,
} from "./util";

test("core / util / pathExists", async () => {
  await expect(pathExists("./path_not_exist")).resolves.toBe(false);

  await expect(pathExists(__filename)).resolves.toBe(true);
});

test("core / util / pathExistsSync", () => {
  expect(pathExistsSync("./path_not_exist")).toBe(false);

  expect(pathExistsSync(__filename)).toBe(true);
});

test("core / util / toAbsolutePath", () => {
  if (process.platform === "win32") {
    expect(normalizeFilepath("d:\\path\\to\\file")).toEqual(
      "D:\\path\\to\\file"
    );
    expect(toAbsolutePath("./any/file", "d:\\any\\absolute\\path")).toEqual(
      "d:\\any\\absolute\\path\\any\\file"
    );

    expect(
      toAbsolutePath("d:\\any\\absolute\\path", "d:\\any\\other\\path")
    ).toEqual("d:\\any\\absolute\\path");
  } else {
    expect(toAbsolutePath("./any/file", "/any/absolute/path")).toEqual(
      "/any/absolute/path/any/file"
    );

    expect(toAbsolutePath("/any/absolute/path", "/any/other/path")).toEqual(
      "/any/absolute/path"
    );
  }
});

test("core / util / escapeRegExp", () => {
  expect(escapeRegExp("/User/demo/file/path")).toEqual("/User/demo/file/path");

  expect(
    escapeRegExp("C:\\Users\\runneradmin\\AppData\\Local\\deno\\deps\\")
  ).toEqual(
    "C:\\\\Users\\\\runneradmin\\\\AppData\\\\Local\\\\deno\\\\deps\\\\"
  );
});

test("core / util / isHttpURL", () => {
  expect(isHttpURL("/User/demo/file/path")).toBeFalsy();
  expect(isHttpURL("https")).toBeFalsy();
  expect(isHttpURL("https://")).toBeFalsy();
  expect(isHttpURL("https://example")).toBeTruthy();
  expect(isHttpURL("https://example.com")).toBeTruthy();
  expect(isHttpURL("https://**@!)($LFKASD><MASD}{][\\")).toBeFalsy();
});

test("core / util / hashURL", () => {
  // example from __test_ folder
  expect(hashURL(new URL("https://example.com/esm/mod.ts"))).toEqual(
    "8afd52da760dab7f2deda4b7453197f50421f310372c5da3f3847ffd062fa1cf"
  );
});

test("core / util / normalizeFilepath", () => {
  if (process.platform === "win32") {
    expect(normalizeFilepath("/path/to/file")).toEqual("\\path\\to\\file");
  } else {
    expect(normalizeFilepath("/path/to/file")).toEqual("/path/to/file");
  }

  expect(normalizeFilepath("d:\\path\\to\\file")).toEqual("D:\\path\\to\\file");
});

test("core / util / isValidDenoDocument", () => {
  expect(isValidDenoDocument("foo")).toBe(false);
  expect(isValidDenoDocument("bar")).toBe(false);
  expect(isValidDenoDocument("javascript")).toBe(true);
  expect(isValidDenoDocument("javascriptreact")).toBe(true);
  expect(isValidDenoDocument("typescript")).toBe(true);
  expect(isValidDenoDocument("typescriptreact")).toBe(true);
});

test("core / util / isUntitledDocument", () => {
  expect(isUntitledDocument("foo")).toBe(false);
  expect(isUntitledDocument("./foo")).toBe(false);
  expect(isUntitledDocument("../bar")).toBe(false);
  expect(isUntitledDocument("untitled: ")).toBe(true);
});

test("core / util / findNonExtensionModule", () => {
  expect(findNonExtensionModule(__filename, "./deno")).toBe("./deno.ts");
  expect(findNonExtensionModule(__filename, "./logger")).toBe("./logger.ts");
  expect(findNonExtensionModule(__filename, "./testdata/file_walker/a")).toBe(
    "./testdata/file_walker/a.js"
  );
  expect(findNonExtensionModule(__filename, "./none")).toBe("./none");
});

test("core / util / isSetAndNotEmptyString", () => {
  expect(isSetAndNotEmptyString(null)).toBe(false);
  expect(isSetAndNotEmptyString(undefined)).toBe(false);
  expect(isSetAndNotEmptyString("")).toBe(false);

  expect(isSetAndNotEmptyString("hello world")).toBe(true);
});

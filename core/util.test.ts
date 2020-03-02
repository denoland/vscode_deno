import {
  pathExists,
  pathExistsSync,
  str2regexpStr,
  isHttpURL,
  hashURL
} from "./util";

test("core / util / pathExists", async () => {
  await expect(pathExists("./path_not_exist")).resolves.toBe(false);

  await expect(pathExists(__filename)).resolves.toBe(true);
});

test("core / util / pathExistsSync", () => {
  expect(pathExistsSync("./path_not_exist")).toBe(false);

  expect(pathExistsSync(__filename)).toBe(true);
});

test("core / util / str2regexpStr", () => {
  expect(str2regexpStr("/User/demo/file/path")).toEqual("/User/demo/file/path");

  expect(
    str2regexpStr("C:\\Users\\runneradmin\\AppData\\Local\\deno\\deps\\")
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
});

test("core / util / hashURL", () => {
  // example from __test_ folder
  expect(hashURL(new URL("https://example.com/esm/mod.ts"))).toEqual(
    "8afd52da760dab7f2deda4b7453197f50421f310372c5da3f3847ffd062fa1cf"
  );
});

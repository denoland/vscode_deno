import { pathExists, pathExistsSync, str2regexpStr } from "./util";

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

import { str2regexpStr } from "./util";

test("server / util / str2regexpStr", () => {
  expect(str2regexpStr("/User/demo/file/path")).toEqual("/User/demo/file/path");

  expect(
    str2regexpStr("C:\\Users\\runneradmin\\AppData\\Local\\deno\\deps\\")
  ).toEqual(
    "C:\\\\Users\\\\runneradmin\\\\AppData\\\\Local\\\\deno\\\\deps\\\\"
  );
});

import { filepath2regexpStr } from "./util";

test("server / util / filepath2regexpStr", () => {
  expect(filepath2regexpStr("/User/demo/file/path")).toEqual(
    "/User/demo/file/path"
  );

  expect(
    filepath2regexpStr("C:\\Users\\runneradmin\\AppData\\Local\\deno\\deps\\")
  ).toEqual(
    "C:\\\\Users\\\\runneradmin\\\\AppData\\\\Local\\\\deno\\\\deps\\\\"
  );
});

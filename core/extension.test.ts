import { getExtensionFromFile } from "./extension";

test("core / extension: getExtensionFromFile", async () => {
  expect(getExtensionFromFile("./foo.ts")).toBe(".ts");
  expect(getExtensionFromFile("./foo.tsx")).toBe(".tsx");
  expect(getExtensionFromFile("./foo.js")).toBe(".js");
  expect(getExtensionFromFile("./foo.jsx")).toBe(".jsx");
  expect(getExtensionFromFile("./foo.d.ts")).toBe(".d.ts");
  expect(getExtensionFromFile("./foo.json")).toBe(".json");
  expect(getExtensionFromFile("./foo.wasm")).toBe(".wasm");
  expect(getExtensionFromFile("./foo")).toBe("");
});

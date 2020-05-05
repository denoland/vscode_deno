import { getExtensionFromFile, isValidDenoModuleExtension } from "./extension";

test("core / extension: getExtensionFromFile", async () => {
  expect(getExtensionFromFile("./foo.ts")).toBe(".ts");
  expect(getExtensionFromFile("./foo.tsx")).toBe(".tsx");
  expect(getExtensionFromFile("./foo.js")).toBe(".js");
  expect(getExtensionFromFile("./foo.jsx")).toBe(".jsx");
  expect(getExtensionFromFile("./foo.d.ts")).toBe(".d.ts");
  expect(getExtensionFromFile("./foo.wasm")).toBe(".wasm");
  expect(getExtensionFromFile("./foo")).toBe("");
});

test("core / extension: isValidDenoModuleExtension", async () => {
  expect(isValidDenoModuleExtension("./foo.ts")).toBeTruthy();
  expect(isValidDenoModuleExtension("./foo.tsx")).toBeTruthy();
  expect(isValidDenoModuleExtension("./foo.js")).toBeTruthy();
  expect(isValidDenoModuleExtension("./foo.jsx")).toBeTruthy();
  expect(isValidDenoModuleExtension("./foo.d.ts")).toBeTruthy();
  expect(isValidDenoModuleExtension("./foo.wasm")).toBeTruthy();
  expect(isValidDenoModuleExtension("./foo")).toBeFalsy();
  expect(isValidDenoModuleExtension("./foo.json")).toBeFalsy();
});

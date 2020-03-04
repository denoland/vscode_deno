import * as path from "path";

import { FileWalker } from "./file_walker";

const TEST_DIR = path.join(__dirname, "..", "__test__");

test("core / FileWalker", async () => {
  const walker = FileWalker.create(path.join(TEST_DIR, "file_walker"));

  const files = [
    path.join(TEST_DIR, "file_walker", "a.js"),
    path.join(TEST_DIR, "file_walker", "b.ts"),
    path.join(TEST_DIR, "file_walker", "node_modules", "c.ts")
  ];

  const result = [];

  for await (const file of walker) {
    expect(typeof file).toBe("string");
    expect(path.isAbsolute(file)).toBe(true);
    result.push(file);
  }

  expect(result).toEqual(files);
});

test("core / FileWalker with specified extension name", async () => {
  const walker = FileWalker.create(path.join(TEST_DIR, "file_walker"), {
    extensionName: [".ts", ".tsx"]
  });

  const files = [path.join(TEST_DIR, "file_walker", "b.ts")];

  const result = [];

  for await (const file of walker) {
    expect(typeof file).toBe("string");
    expect(path.isAbsolute(file)).toBe(true);
    result.push(file);
  }

  expect(result).toEqual(files);
});

test("core / FileWalker with exclude options", async () => {
  const walker = FileWalker.create(path.join(TEST_DIR, "file_walker"), {
    exclude: ["node_modules"]
  });

  const files = [
    path.join(TEST_DIR, "file_walker", "a.js"),
    path.join(TEST_DIR, "file_walker", "b.ts")
  ];

  const result = [];

  for await (const file of walker) {
    expect(typeof file).toBe("string");
    expect(path.isAbsolute(file)).toBe(true);
    result.push(file);
  }

  expect(result).toEqual(files);
});

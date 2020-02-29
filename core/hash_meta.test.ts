import * as path from "path";

import { HashMeta, Type } from "./hash_meta";

const TEST_DIR = path.join(__dirname, "..", "__test__");
const denoDir = path.join(TEST_DIR, "deno_dir_manifest");

const cacheFilepath = path.join(
  denoDir,
  "deps",
  "https",
  "example.com",
  "933405cb905c548e870daee56d0589b7dd8e146c0cdbd5f16a959f8227c1fe06"
);

beforeAll(() => {
  process.env["DENO_DIR"] = denoDir;
});

afterAll(() => {
  process.env["DENO_DIR"] = undefined;
});

test("core / hash_meta", () => {
  const meta = HashMeta.create(cacheFilepath + ".metadata.json") as HashMeta;
  expect(meta).not.toBe(undefined);
  expect(meta.filepath).toEqual(cacheFilepath + ".metadata.json");
  expect(meta.type).toEqual(Type.TypeScript);
  expect(meta.url.href).toEqual("https://example.com/demo/mod.ts");
  expect(meta.destinationFilepath).toEqual(cacheFilepath);
});

test("core / hash_meta: if not exist", () => {
  const notExistCache = path.join(
    denoDir,
    "deps",
    "https",
    "example.com",
    "933405cb905c548e870daee56d0589b7dd8e146c0cdbd5f16a959f8227c1fxxx"
  );

  const meta = HashMeta.create(notExistCache + ".metadata.json");
  expect(meta).toBe(undefined);
});

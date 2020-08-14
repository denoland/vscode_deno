import * as path from "path";

import { HashMeta, Type } from "./hash_meta";

const TEST_DIR = path.join(__dirname, "..", "tests");
const denoDir = path.join(TEST_DIR, "deno_dir_manifest");

beforeAll(() => {
  process.env["DENO_DIR"] = denoDir;
});

afterAll(() => {
  process.env["DENO_DIR"] = undefined;
});

test("core / hash_meta", () => {
  const cacheFilepath = path.join(
    denoDir,
    "deps",
    "https",
    "example.com",
    "933405cb905c548e870daee56d0589b7dd8e146c0cdbd5f16a959f8227c1fe06"
  );
  const meta = HashMeta.create(cacheFilepath + ".metadata.json") as HashMeta;
  expect(meta).not.toBe(undefined);
  expect(meta.filepath).toEqual(cacheFilepath + ".metadata.json");
  expect(meta.type).toEqual(Type.TypeScript);
  expect(meta.extension).toEqual(".ts");
  expect(meta.url.href).toEqual("https://example.com/demo/mod.ts");
  expect(meta.destinationFilepath).toEqual(cacheFilepath);
});

test("core / hash_meta with javascript file", () => {
  const cacheFilepath = path.join(
    denoDir,
    "deps",
    "https",
    "example.com",
    "f13574acadcffaf55de9aada6cffa50fe178ac8b0ea1bc5aebf022b93e248f98"
  );

  const meta = HashMeta.create(cacheFilepath + ".metadata.json") as HashMeta;
  expect(meta).not.toBe(undefined);
  expect(meta.filepath).toEqual(cacheFilepath + ".metadata.json");
  expect(meta.type).toEqual(Type.JavaScript);
  expect(meta.extension).toEqual(".js");
  expect(meta.url.href).toEqual("https://example.com/demo.js");
  expect(meta.destinationFilepath).toEqual(cacheFilepath);
});

test("core / hash_meta without extension name", () => {
  const cacheFilepath = path.join(
    denoDir,
    "deps",
    "https",
    "example.com",
    "80f9458ee4d37ba8e56a92d01e5cbd229f10e8cf4f3ab31823c289cf031c630d"
  );

  const meta = HashMeta.create(cacheFilepath + ".metadata.json") as HashMeta;
  expect(meta).not.toBe(undefined);
  expect(meta.filepath).toEqual(cacheFilepath + ".metadata.json");
  expect(meta.type).toEqual(Type.PlainText);
  expect(meta.extension).toEqual("");
  expect(meta.url.href).toEqual("https://example.com/without-extension-name");
  expect(meta.destinationFilepath).toEqual(cacheFilepath);
});

test("core / hash_meta if have content-type", () => {
  const cacheFilepath = path.join(
    denoDir,
    "deps",
    "https",
    "example.com",
    "91eadc577dcd94ede732f546c6725fb79d9d24924505c05a22f657ec31c78f31"
  );

  const meta = HashMeta.create(cacheFilepath + ".metadata.json") as HashMeta;
  expect(meta).not.toBe(undefined);
  expect(meta.filepath).toEqual(cacheFilepath + ".metadata.json");
  expect(meta.type).toEqual(Type.JavaScript);
  expect(meta.extension).toEqual(".js");
  expect(meta.url.href).toEqual("https://example.com/content-type");
  expect(meta.destinationFilepath).toEqual(cacheFilepath);
});

test("core / hash_meta if have content-type typescript", () => {
  const cacheFilepath = path.join(
    denoDir,
    "deps",
    "https",
    "example.com",
    "94b9af04676e29b71da17af190d513d298fabcdeeeaddf90ee36000fed3f534a"
  );

  const meta = HashMeta.create(cacheFilepath + ".metadata.json") as HashMeta;
  expect(meta).not.toBe(undefined);
  expect(meta.filepath).toEqual(cacheFilepath + ".metadata.json");
  expect(meta.type).toEqual(Type.TypeScript);
  expect(meta.extension).toEqual(".ts");
  expect(meta.url.href).toEqual("https://example.com/content-type-typescript");
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

test("core / hash_meta: if meta file missing url", () => {
  const notExistCache = path.join(
    denoDir,
    "deps",
    "https",
    "invalid_mta.com",
    "1d6ab9051e9ae4e3a9d501b1a4316583ae8ecd51d41d327b514abf0194c14dc4"
  );

  const meta = HashMeta.create(notExistCache + ".metadata.json");
  expect(meta).toBe(undefined);
});

test("core / hash_meta: if meta file missing headers", () => {
  const notExistCache = path.join(
    denoDir,
    "deps",
    "https",
    "invalid_mta.com",
    "2f5c120425d2222c81506ea48f25c608a89272ed179233ab4fd47debb0f5d05f"
  );

  const meta = HashMeta.create(notExistCache + ".metadata.json");
  expect(meta).toBe(undefined);
});

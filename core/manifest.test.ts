import * as path from "path";

import { Manifest, IManifest } from "./manifest";

const TEST_DIR = path.join(__dirname, "..", "__test__");
const denoDir = path.join(TEST_DIR, "deno_dir_manifest");

beforeAll(() => {
  process.env["DENO_DIR"] = denoDir;
});

afterAll(() => {
  process.env["DENO_DIR"] = undefined;
});

test("core / manifest", () => {
  expect(
    Manifest.create(
      path.join(denoDir, "deps", "https", "not.exist.com", "manifest.json")
    )
  ).toBe(undefined);

  const exampleOriginManifest = Manifest.create(
    path.join(denoDir, "deps", "https", "example.com", "manifest.json")
  ) as IManifest;

  expect(exampleOriginManifest).not.toBe(undefined);
  expect(exampleOriginManifest.origin).toEqual("https://example.com");
  expect(exampleOriginManifest.filepath).toEqual(
    path.join(denoDir, "deps", "https", "example.com", "manifest.json")
  );

  expect(exampleOriginManifest.getHashFromUrlPath("/demo/mod.ts")).toEqual(
    "933405cb905c548e870daee56d0589b7dd8e146c0cdbd5f16a959f8227c1fe06"
  );
  expect(exampleOriginManifest.getHashFromUrlPath("/demo/sub/mod.ts")).toEqual(
    "da88efaa8b70cda7903ddc29b8d4c6ea3015de65329ea393289f4104ae2da941"
  );
  expect(exampleOriginManifest.getHashFromUrlPath("/esm/mod.ts")).toEqual(
    "8afd52da760dab7f2deda4b7453197f50421f310372c5da3f3847ffd062fa1cf"
  );

  expect(
    exampleOriginManifest.getUrlPathFromHash(
      "933405cb905c548e870daee56d0589b7dd8e146c0cdbd5f16a959f8227c1fe06"
    )
  ).toEqual("/demo/mod.ts");

  expect(
    exampleOriginManifest.getUrlPathFromHash(
      "da88efaa8b70cda7903ddc29b8d4c6ea3015de65329ea393289f4104ae2da941"
    )
  ).toEqual("/demo/sub/mod.ts");

  expect(
    exampleOriginManifest.getUrlPathFromHash(
      "8afd52da760dab7f2deda4b7453197f50421f310372c5da3f3847ffd062fa1cf"
    )
  ).toEqual("/esm/mod.ts");
});

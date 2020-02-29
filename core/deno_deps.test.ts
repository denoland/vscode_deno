import * as path from "path";

import { getDenoDeps } from "./deno_deps";

const TEST_DIR = path.join(__dirname, "..", "__test__");
const denoDir = path.join(TEST_DIR, "deno_dir_manifest");
const denoDepsDir = path.join(denoDir, "deps");

beforeAll(() => {
  process.env["DENO_DIR"] = denoDir;
});

afterAll(() => {
  process.env["DENO_DIR"] = undefined;
});

test("core / deno_deps", async () => {
  const deps = await getDenoDeps();

  for (const dep of deps) {
    expect(typeof dep.filepath === "string").toBeTruthy();
    expect(dep.filepath.indexOf(denoDepsDir) == 0).toBeTruthy();
    expect(typeof dep.url === "string").toBeTruthy();
    expect(new URL(dep.url)).toBeTruthy();
  }
});

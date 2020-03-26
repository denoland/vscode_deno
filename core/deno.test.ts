import * as path from "path";

import execa from "execa";
import which from "which";

import {
  getDenoDir,
  getDenoDepsDir,
  getDenoDts,
  isInDeno,
  URL2filepath,
} from "./deno";

test("core / deno", () => {
  expect(getDenoDir()).not.toBe(undefined);
  expect(getDenoDepsDir()).not.toBe(undefined);

  expect(getDenoDepsDir()).toContain(getDenoDir());

  const denoPath = which.sync("deno");

  const ps = execa.sync(denoPath, ["info"]);

  const lines = ps.stdout.split("\n");
  const firstLine = lines[0];

  const [, denoDir] = /"([^"]+)"/.exec(firstLine) as string[];

  expect(getDenoDir()).toEqual(path.normalize(denoDir));

  isInDeno(path.join(getDenoDir(), "https", "example.com", "/mod.ts"));
});

test("core / deno / getDenoDts()", () => {
  expect(getDenoDts()).toBe(path.join(getDenoDir(), "lib.deno_runtime.d.ts"));
});

test("core / deno / URL2filepath()", () => {
  expect(URL2filepath(new URL("https://example.com/esm/mod.ts"))).toBe(
    path.join(
      getDenoDepsDir(),
      "https",
      "example.com",
      "8afd52da760dab7f2deda4b7453197f50421f310372c5da3f3847ffd062fa1cf"
    )
  );
});

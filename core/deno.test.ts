import * as path from "path";

import execa from "execa";
import which from "which";

import { getDenoDir, getDenoDepsDir, isInDeno } from "./deno";

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

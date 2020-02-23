import { getDenoDir, getDenoDepsDir } from "./deno";

test("core / deno", () => {
  expect(getDenoDir()).not.toBe(undefined);
  expect(getDenoDepsDir()).not.toBe(undefined);

  expect(getDenoDepsDir()).toContain(getDenoDir());
});

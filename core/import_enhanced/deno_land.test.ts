import { DenoLand } from "./deno_land";

test("core / import_enhanced: deno_land", async () => {
  const denoland = new DenoLand();
  expect((await denoland.std())?.versions).toBeTruthy();
  denoland.modList().then((it) => expect(it).toBeTruthy());
  expect(await denoland.modContents("sha256", ["v1.0.2"])).toBeTruthy();
});

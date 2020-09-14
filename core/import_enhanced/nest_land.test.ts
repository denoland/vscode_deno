import { NestLand } from "./nest_land";

test("core / import_enhanced: nest_land", async () => {
  const nestland = new NestLand();
  expect((await nestland.std())?.versions).toBeTruthy();
  nestland.modList().then((it) => expect(it).toBeTruthy());
  expect(await nestland.modContents("moment", ["1.0.0"])).toBeTruthy();
});

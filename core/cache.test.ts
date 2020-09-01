import { Cache } from "./cache";
import { sleep } from "./util";

test("core / cache: timeout", async () => {
  const cache = Cache.create<string>(1000);

  expect(cache.get()).toBe(undefined);
  expect(cache.set("hello")).toBe(undefined);
  expect(cache.get()).toEqual("hello");

  await sleep(500);

  expect(cache.get()).toEqual("hello");
  await sleep(500);

  expect(cache.get()).toBe(undefined);
});

test("core / cache: times out", async () => {
  const cache = Cache.create<string>(5000, 5);

  cache.set("hello");
  expect(cache.get()).toEqual("hello"); // 1

  await sleep(500);
  expect(cache.get()).toEqual("hello"); // 2
  expect(cache.get()).toEqual("hello"); // 3
  expect(cache.get()).toEqual("hello"); // 4
  expect(cache.get()).toEqual("hello"); // 5
  expect(cache.get()).toBe(undefined); // 6
});

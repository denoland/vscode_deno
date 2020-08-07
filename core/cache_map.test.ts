import { CacheMap } from "./cache_map";
import { sleep } from "./util";

test("core / cache_map: timeout", async () => {
  const cache = CacheMap.create<string>(1000);

  expect(cache.get("foo")).toBe(undefined);
  expect(cache.set("foo", "bar")).toBe(undefined);
  expect(cache.get("foo")).toEqual("bar");

  await sleep(500);

  expect(cache.get("foo")).toEqual("bar");
  await sleep(500);

  expect(cache.get("foo")).toBe(undefined);
});

test("core / cache_map: times out", async () => {
  const cache = CacheMap.create<string>(5000, 5);

  cache.set("foo", "bar");
  expect(cache.get("foo")).toEqual("bar"); // 1

  await sleep(500);
  expect(cache.get("foo")).toEqual("bar"); // 2
  expect(cache.get("foo")).toEqual("bar"); // 3
  expect(cache.get("foo")).toEqual("bar"); // 4
  expect(cache.get("foo")).toEqual("bar"); // 5
  expect(cache.get("foo")).toBe(undefined); // 6
});

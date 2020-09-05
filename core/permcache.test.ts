import { PermCache, TRANSACTION_STATE } from "./permcache";
import { sleep } from "./util";

test("core / permcache", async () => {
  const data = [1, 2];
  const cache = await PermCache.create("test", 1);

  // test expired
  await sleep(500);
  expect(cache.expired()).toBeFalsy();
  await sleep(500);
  expect(cache.expired()).toBeTruthy();

  expect(cache.get()).toEqual(undefined);
  await cache.set(data);
  expect(cache.get()).toEqual(data);
  expect(await cache.reload_get()).toEqual(data);

  // test transaction
  expect(cache.transaction_begin()).toEqual(TRANSACTION_STATE.SUCCESS);
  expect(cache.transaction_begin()).toEqual(
    TRANSACTION_STATE.ALREADY_IN_TRANSACTION
  );
  cache
    .set([2, 3])
    .then(() => fail())
    .catch((reason) =>
      expect(reason).toEqual(TRANSACTION_STATE.ALREADY_IN_TRANSACTION)
    );
  expect(cache.transaction_set([2, 3])).toEqual(TRANSACTION_STATE.SUCCESS);
  expect(cache.get()).toEqual(data);
  expect(cache.transaction_get().state).toEqual(TRANSACTION_STATE.SUCCESS);
  expect(cache.transaction_get().data).toEqual([2, 3]);
  expect(await cache.transaction_commit()).toEqual(TRANSACTION_STATE.SUCCESS);
  expect(cache.get()).toEqual([2, 3]);
  expect(await cache.reload_get()).toEqual([2, 3]);

  // test transaction_abort
  expect(cache.transaction_begin()).toEqual(TRANSACTION_STATE.SUCCESS);
  expect(cache.transaction_set([1, 2]));
  expect(cache.transaction_abort()).toEqual(TRANSACTION_STATE.SUCCESS);
  expect(cache.transaction_abort()).toEqual(
    TRANSACTION_STATE.NOT_IN_TRANSACTION
  );
  expect(cache.get()).toEqual([2, 3]);
  expect(await cache.reload_get()).toEqual([2, 3]);

  // test destroy_cache
  await cache.destroy_cache();
  expect(cache.get()).toEqual(undefined);
  expect(await cache.reload_get()).toEqual(undefined);
});

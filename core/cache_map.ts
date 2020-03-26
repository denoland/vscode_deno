import assert from "assert";

interface CacheEntry<T> {
  data: T;
  updatedAt: Date;
  referenceTimes: number;
}

/**
 * A key-value Cache module, cache data
 * TODO: Periodically clean up expired caches, otherwise memory leaks will occur
 */
export class CacheMap<T> {
  /**
   * create a cache module
   * @param timeout How long will this data expire. If expired, return undefined. eg 1000ms
   * @param allowReferenceTimes How many times the data can be referenced.If 0, no restrictions
   */
  static create<T>(timeout: number, allowReferenceTimes?: number) {
    return new CacheMap<T>(timeout, allowReferenceTimes);
  }

  private map = new Map<string, CacheEntry<T>>();

  constructor(private timeout: number, private allowReferenceTimes?: number) {
    assert(timeout > 0, "Timeout of cache must be a positive integer");
    if (allowReferenceTimes !== undefined) {
      assert(
        allowReferenceTimes > 0,
        "allowReferenceTimes of cache must be a positive integer"
      );
    }
  }
  /**
   * Get data from cache
   */
  get(key: string): T | void {
    const entry = this.map.get(key);

    if (!entry) {
      return;
    }

    // If expired
    const isTimeout =
      entry.updatedAt.getTime() + this.timeout < new Date().getTime();

    const isUseManyTimes = this.allowReferenceTimes
      ? entry.referenceTimes >= this.allowReferenceTimes
        ? true
        : false
      : false;

    if (isTimeout || isUseManyTimes) {
      this.map.delete(key);
      return;
    }

    entry.referenceTimes++;

    return entry.data;
  }
  /**
   * Set cache
   * @param value
   */
  set(key: string, value: T): void {
    this.map.set(key, {
      data: value,
      updatedAt: new Date(),
      referenceTimes: 0,
    });
  }
}

import assert from "assert";

/**
 * Cache module, cache data
 */
export class Cache<T> {
  /**
   * create a cache module
   * @param timeout How long will this data expire. If expired, return undefined. eg 1000ms
   * @param allowReferenceTimes How many times the data can be referenced.If 0, no restrictions
   */
  static create<T>(timeout: number, allowReferenceTimes?: number) {
    return new Cache<T>(timeout, allowReferenceTimes);
  }

  private data: T | void = undefined;
  private updatedAt: Date = new Date();
  private referenceTimes: number = 0; // Reference count
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
  get(): T | void {
    // If expired
    const isTimeout =
      this.updatedAt.getTime() + this.timeout < new Date().getTime();

    const isUseManyTimes = this.allowReferenceTimes
      ? this.referenceTimes >= this.allowReferenceTimes
        ? true
        : false
      : false;

    if (isTimeout || isUseManyTimes) {
      this.data = undefined;
      return;
    }

    this.referenceTimes++;

    return this.data;
  }
  /**
   * Set cache
   * @param data
   */
  set(data: T): void {
    this.data = data;
    this.updatedAt = new Date();
    this.referenceTimes = 0;
  }
}

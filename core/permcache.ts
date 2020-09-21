// Permanent version of the Cache from cache.ts in the same folder
import { promises as fsp } from "fs";
import fs from "fs";
import path from "path";

export function getVSCodeDenoDir(): string {
  let vscodeDenoDir =
    process.env.VSCODE_DENO_EXTENSION_PATH !== undefined
      ? path.join(process.env.VSCODE_DENO_EXTENSION_PATH, "cache")
      : undefined;
  if (vscodeDenoDir === undefined) {
    switch (process.platform) {
      case "win32":
        vscodeDenoDir = `${process.env.LOCALAPPDATA}\\vscode_deno`;
        break;
      case "darwin":
        vscodeDenoDir = `${process.env.HOME}/Library/Caches/vscode_deno`;
        break;
      case "linux":
        vscodeDenoDir = process.env.XDG_CACHE_HOME
          ? `${process.env.XDG_CACHE_HOME}/vscode_deno`
          : `${process.env.HOME}/.cache/vscode_deno`;
        break;
      default:
        vscodeDenoDir = `${process.env.HOME}/.vscode_deno`;
    }
  }

  return vscodeDenoDir;
}

interface CacheFormat<T> {
  expiring_date: number | undefined;
  data: T | undefined;
}

export enum TRANSACTION_STATE {
  SUCCESS = 1,
  ALREADY_IN_TRANSACTION = -1,
  NOT_IN_TRANSACTION = -2,
}

export class PermCache<T> {
  private cache_file_path: string;

  // In transition mode, write to this instead
  private transaction: CacheFormat<T> | undefined;

  private inner_data: CacheFormat<T> | undefined;

  static async create<T>(
    namespace: string,
    timeout?: number
  ): Promise<PermCache<T>> {
    const vscode_deno_path = getVSCodeDenoDir();
    const cache_file_path = path.join(vscode_deno_path, `${namespace}.json`);
    const expiring_date =
      timeout === undefined ? undefined : new Date().getTime() + timeout * 1000; // to millis
    if (!fs.existsSync(vscode_deno_path)) {
      await fsp.mkdir(vscode_deno_path, { recursive: true });
    }

    let cache_file: fsp.FileHandle;
    if (!fs.existsSync(cache_file_path)) {
      // Cache don't exist, create one
      cache_file = await fsp.open(cache_file_path, "w");

      const cache = { expiring_date, data: undefined } as CacheFormat<T>;
      await cache_file.writeFile(JSON.stringify(cache));
      await cache_file.close();

      return new PermCache<T>(cache_file_path, cache);
    } else {
      // Cache maybe exist, try read cache from cache file
      const file_content = await fsp.readFile(cache_file_path, "utf-8");
      const cache = JSON.parse(file_content) as CacheFormat<T>;

      if (
        !Object.getOwnPropertyNames(cache).every(
          (it) => it === "expiring_date" || it === "data"
        )
      ) {
        // If cache format not correct, clear the file
        await fsp.writeFile(cache_file_path, "");
        return new PermCache<T>(cache_file_path, {
          expiring_date,
          data: undefined,
        });
      }

      if (cache.data == undefined) {
        return new PermCache<T>(cache_file_path, {
          expiring_date: cache.expiring_date,
          data: undefined,
        });
      }

      return new PermCache<T>(cache_file_path, cache);
    }
  }

  private constructor(file: string, cache: CacheFormat<T> | undefined) {
    this.transaction = undefined;
    this.cache_file_path = file;
    this.inner_data = cache;
  }

  async reload(): Promise<void> {
    if (fs.existsSync(this.cache_file_path)) {
      const cache_file_content = await fsp.readFile(
        this.cache_file_path,
        "utf-8"
      );
      this.inner_data = JSON.parse(cache_file_content) as CacheFormat<T>;
      return;
    }
    this.inner_data = undefined;
  }

  get(): T | undefined {
    return this.inner_data?.data;
  }

  expired(): boolean {
    const now = new Date().getTime();
    if (
      this.inner_data !== undefined &&
      this.inner_data.expiring_date !== undefined
    ) {
      return now >= this.inner_data.expiring_date;
    }
    return false;
  }

  async reload_expired(): Promise<boolean> {
    await this.reload();
    return this.expired();
  }

  async reload_get(): Promise<T | undefined> {
    await this.reload();
    return this.inner_data?.data;
  }

  async set(data: T | undefined): Promise<void> {
    if (this.transaction !== undefined) {
      return Promise.reject(TRANSACTION_STATE.ALREADY_IN_TRANSACTION);
    }
    if (this.inner_data !== undefined) {
      this.inner_data.data = data;
      await fsp.writeFile(
        this.cache_file_path,
        JSON.stringify(this.inner_data),
        "utf-8"
      );
    } else {
      this.inner_data = { expiring_date: undefined, data };
      await fsp.writeFile(
        this.cache_file_path,
        JSON.stringify(this.inner_data),
        "utf-8"
      );
    }
  }

  // WARNING: this function will completely delete the cache from disk
  // AND MUST await on this function
  async destroy_cache(): Promise<void> {
    if (fs.existsSync(this.cache_file_path)) {
      await fsp.unlink(this.cache_file_path);
      this.transaction = undefined;
      this.inner_data = undefined;
    }
  }

  transaction_begin(): TRANSACTION_STATE {
    if (this.transaction !== undefined) {
      return TRANSACTION_STATE.ALREADY_IN_TRANSACTION;
    }
    this.transaction = {
      expiring_date: undefined,
      data: undefined,
      ...this.inner_data,
    } as CacheFormat<T>;
    return TRANSACTION_STATE.SUCCESS;
  }

  transaction_get(): { state: TRANSACTION_STATE; data: T | undefined } {
    if (this.transaction !== undefined) {
      return { state: TRANSACTION_STATE.SUCCESS, data: this.transaction.data };
    }
    return { state: TRANSACTION_STATE.NOT_IN_TRANSACTION, data: undefined };
  }

  transaction_set(data: T | undefined): TRANSACTION_STATE {
    if (this.transaction !== undefined) {
      this.transaction.data = data;
      return TRANSACTION_STATE.SUCCESS;
    }
    return TRANSACTION_STATE.NOT_IN_TRANSACTION;
  }

  transaction_abort(): TRANSACTION_STATE {
    if (this.transaction !== undefined) {
      this.transaction = undefined;
      return TRANSACTION_STATE.SUCCESS;
    }
    return TRANSACTION_STATE.NOT_IN_TRANSACTION;
  }

  async transaction_commit(): Promise<TRANSACTION_STATE> {
    if (this.transaction !== undefined) {
      await fsp.writeFile(
        this.cache_file_path,
        JSON.stringify(this.transaction)
      );
      await this.reload_get();
      this.transaction = undefined;
      return TRANSACTION_STATE.SUCCESS;
    }
    return TRANSACTION_STATE.NOT_IN_TRANSACTION;
  }
}

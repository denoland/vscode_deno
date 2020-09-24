// Permanent version of the Cache from cache.ts in the same folder
import { promises as fsp } from "fs";
import path from "path";
import crypto from "crypto";

export function getVSCodeDenoDir(): string {
  let vscodeDenoDir =
    process.env.VSCODE_DENO_EXTENSION_PATH !== undefined
      ? path.join(process.env.VSCODE_DENO_EXTENSION_PATH, "cache")
      : undefined;
  if (vscodeDenoDir === undefined) {
    switch (process.platform) {
      /* istanbul ignore next */
      case "win32":
        vscodeDenoDir = `${process.env.LOCALAPPDATA}\\vscode_deno`;
        break;
      /* istanbul ignore next */
      case "darwin":
        vscodeDenoDir = `${process.env.HOME}/Library/Caches/vscode_deno`;
        break;
      /* istanbul ignore next */
      case "linux":
        vscodeDenoDir = process.env.XDG_CACHE_HOME
          ? `${process.env.XDG_CACHE_HOME}/vscode_deno`
          : `${process.env.HOME}/.cache/vscode_deno`;
        break;
      /* istanbul ignore next */
      default:
        vscodeDenoDir = `${process.env.HOME}/.vscode_deno`;
    }
  }
  return vscodeDenoDir;
}

interface CachedData<T> {
  expires_at: string;
  data: T;
}

export class DiskCache {
  private path: string;

  constructor(namespace: string, private defaultTTL: number) {
    this.path = path.join(getVSCodeDenoDir(), namespace);
    fsp.mkdir(this.path).catch(() => undefined);
  }

  private hash(key: string): string {
    const sha256 = crypto.createHash("sha256");
    sha256.update(key);
    const hash = sha256.digest().toString("hex");
    return hash;
  }

  async get<T>(key: string): Promise<T | undefined> {
    const filepath = path.join(this.path, this.hash(key));
    try {
      const file = await fsp.readFile(filepath, { encoding: "utf8" });
      const decoded: CachedData<T> = JSON.parse(file);
      const now = new Date();
      if (new Date(decoded.expires_at) <= now) return undefined;
      return decoded.data;
    } catch {
      return undefined;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const filepath = path.join(this.path, this.hash(key));
    const now = new Date().getTime();
    const expiresAt = new Date(now + (ttl ?? this.defaultTTL));
    await fsp.writeFile(
      filepath,
      JSON.stringify({
        expires_at: expiresAt.toISOString(),
        data: value,
      } as CachedData<T>),
      { encoding: "utf8" }
    );
  }

  async delete(key: string): Promise<boolean> {
    const filepath = path.join(this.path, this.hash(key));
    await fsp.unlink(filepath);
    return true;
  }

  async clear(): Promise<void> {
    await fsp.rmdir(this.path, { recursive: true });
    await fsp.mkdir(this.path, { recursive: true });
  }
}

// Durable key-value store for the registry, ledger, and submitted signals.
//
// On Vercel the filesystem under /tmp is ephemeral and per-instance, so a
// file-backed ledger silently vanishes on cold start and diverges across
// lambda instances. When Upstash Redis REST credentials are present we use a
// shared Redis instead, which makes the economy ledger actually persist and
// stay consistent across instances. Without credentials we fall back to JSON
// files under the data dir, which is fine for local dev and demos.
//
// Reads and writes for a given key are serialized through an in-process queue
// so two concurrent requests cannot clobber each other's read-modify-write.

import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

const DATA_DIR =
  process.env.LODE_DATA_DIR ||
  (process.env.VERCEL ? path.join(os.tmpdir(), "lode") : path.join(process.cwd(), "data"));

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "";
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";
const useRedis = Boolean(REDIS_URL && REDIS_TOKEN);

export function storageBackend(): "redis" | "file" {
  return useRedis ? "redis" : "file";
}

// ---- redis REST -------------------------------------------------------------

async function redisCommand(cmd: unknown[]): Promise<unknown> {
  const res = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`redis ${res.status}`);
  const json = (await res.json()) as { result?: unknown; error?: string };
  if (json.error) throw new Error(json.error);
  return json.result;
}

// ---- file backend -----------------------------------------------------------

function filePath(key: string): string {
  return path.join(DATA_DIR, `${key}.json`);
}

async function fileRead<T>(key: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(filePath(key), "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function fileWrite<T>(key: string, value: T): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(filePath(key), JSON.stringify(value, null, 2));
}

// ---- public api -------------------------------------------------------------

export async function readJson<T>(key: string, fallback: T): Promise<T> {
  if (!useRedis) return fileRead(key, fallback);
  const raw = (await redisCommand(["GET", key])) as string | null;
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(key: string, value: T): Promise<void> {
  if (!useRedis) return fileWrite(key, value);
  await redisCommand(["SET", key, JSON.stringify(value)]);
}

// Per-key promise chain: serialize read-modify-write so concurrent callers do
// not read the same array and clobber each other on write.
const locks = new Map<string, Promise<unknown>>();

export async function mutate<T>(key: string, fallback: T, fn: (current: T) => T | Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  const run = prev.then(async () => {
    const current = await readJson<T>(key, fallback);
    const next = await fn(current);
    await writeJson(key, next);
    return next;
  });
  // Keep the chain alive even if this run rejects, so the lock does not wedge.
  locks.set(
    key,
    run.catch(() => undefined),
  );
  return run;
}

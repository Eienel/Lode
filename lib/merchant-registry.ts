// The merchant registry. Anyone can apply to run a signal merchant by paying a
// registration fee; an admin approves before their signals enter the public
// catalog. Approved merchants submit pre-signed signals which buyers verify the
// same way they verify the house merchant's signals. Backed by JSON files under
// the same data dir the ledger uses.

import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import type { MerchantRecord, ExternalSignal } from "./types";

// Matches lib/economy.ts: Vercel only allows writes under /tmp.
const DATA_DIR = process.env.LODE_DATA_DIR || (process.env.VERCEL ? path.join(os.tmpdir(), "lode") : path.join(process.cwd(), "data"));
const MERCHANTS_PATH = path.join(DATA_DIR, "merchants.json");
const EXTERNAL_SIGNALS_PATH = path.join(DATA_DIR, "signals.json");

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

// ---- merchant registry ------------------------------------------------------

export async function readRegistry(): Promise<MerchantRecord[]> {
  try {
    return JSON.parse(await fs.readFile(MERCHANTS_PATH, "utf8")) as MerchantRecord[];
  } catch {
    return [];
  }
}

async function writeRegistry(records: MerchantRecord[]): Promise<void> {
  await ensureDir();
  await fs.writeFile(MERCHANTS_PATH, JSON.stringify(records, null, 2));
}

export async function findMerchant(pubkey: string): Promise<MerchantRecord | undefined> {
  return (await readRegistry()).find((r) => r.pubkey === pubkey);
}

export async function registerMerchant(
  data: Omit<MerchantRecord, "status" | "registeredAt" | "feeSharePct">,
): Promise<MerchantRecord> {
  const records = await readRegistry();
  if (records.find((r) => r.pubkey === data.pubkey)) {
    throw new Error("Merchant already registered");
  }
  const record: MerchantRecord = {
    ...data,
    status: "pending",
    feeSharePct: 80,
    registeredAt: new Date().toISOString(),
  };
  await writeRegistry([...records, record]);
  return record;
}

export async function approveMerchant(pubkey: string): Promise<MerchantRecord> {
  const records = await readRegistry();
  const idx = records.findIndex((r) => r.pubkey === pubkey);
  if (idx === -1) throw new Error("Merchant not found");
  records[idx] = { ...records[idx], status: "approved", approvedAt: new Date().toISOString() };
  await writeRegistry(records);
  return records[idx];
}

export async function suspendMerchant(pubkey: string): Promise<MerchantRecord> {
  const records = await readRegistry();
  const idx = records.findIndex((r) => r.pubkey === pubkey);
  if (idx === -1) throw new Error("Merchant not found");
  records[idx] = { ...records[idx], status: "suspended" };
  await writeRegistry(records);
  return records[idx];
}

export async function getApprovedMerchants(): Promise<MerchantRecord[]> {
  return (await readRegistry()).filter((r) => r.status === "approved");
}

export async function getPendingCount(): Promise<number> {
  return (await readRegistry()).filter((r) => r.status === "pending").length;
}

// ---- external signals submitted by approved merchants -----------------------

export async function readExternalSignals(): Promise<ExternalSignal[]> {
  try {
    return JSON.parse(await fs.readFile(EXTERNAL_SIGNALS_PATH, "utf8")) as ExternalSignal[];
  } catch {
    return [];
  }
}

export async function appendExternalSignal(signal: ExternalSignal): Promise<void> {
  await ensureDir();
  const existing = await readExternalSignals();
  if (existing.find((s) => s.id === signal.id)) throw new Error("Signal id already exists");
  await fs.writeFile(EXTERNAL_SIGNALS_PATH, JSON.stringify([...existing, signal], null, 2));
}

// Only return signals whose merchant is currently approved. A suspended
// merchant's signals drop out of the catalog automatically.
export async function getApprovedExternalSignals(): Promise<ExternalSignal[]> {
  const [signals, approved] = await Promise.all([readExternalSignals(), getApprovedMerchants()]);
  const approvedPubkeys = new Set(approved.map((m) => m.pubkey));
  return signals.filter((s) => approvedPubkeys.has(s.merchantAgent));
}

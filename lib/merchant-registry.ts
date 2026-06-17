// The merchant registry. Anyone can apply to run a signal merchant by paying a
// registration fee; an admin approves before their signals enter the public
// catalog. Approved merchants submit pre-signed signals which buyers verify the
// same way they verify the house merchant's signals. Backed by the durable
// store (Redis when configured, JSON files otherwise) with serialized writes.

import { readJson, mutate } from "./store";
import type { MerchantRecord, ExternalSignal } from "./types";

const MERCHANTS_KEY = "merchants";
const SIGNALS_KEY = "signals";

// ---- merchant registry ------------------------------------------------------

export async function readRegistry(): Promise<MerchantRecord[]> {
  return readJson<MerchantRecord[]>(MERCHANTS_KEY, []);
}

export async function findMerchant(pubkey: string): Promise<MerchantRecord | undefined> {
  return (await readRegistry()).find((r) => r.pubkey === pubkey);
}

export async function registerMerchant(
  data: Omit<MerchantRecord, "status" | "registeredAt" | "feeSharePct">,
): Promise<MerchantRecord> {
  let record: MerchantRecord | null = null;
  await mutate<MerchantRecord[]>(MERCHANTS_KEY, [], (records) => {
    if (records.find((r) => r.pubkey === data.pubkey)) {
      throw new Error("Merchant already registered");
    }
    // Replay protection: a registration tx can only be used once.
    if (records.find((r) => r.registrationTx === data.registrationTx)) {
      throw new Error("Registration transaction already used");
    }
    record = {
      ...data,
      status: "pending",
      feeSharePct: 95,
      registeredAt: new Date().toISOString(),
    };
    return [...records, record];
  });
  return record!;
}

// How many signals a merchant has currently listed, used to enforce their cap.
export async function countSignalsForMerchant(pubkey: string): Promise<number> {
  return (await readExternalSignals()).filter((s) => s.merchantAgent === pubkey).length;
}

export async function approveMerchant(pubkey: string): Promise<MerchantRecord> {
  let record: MerchantRecord | undefined;
  await mutate<MerchantRecord[]>(MERCHANTS_KEY, [], (records) => {
    const idx = records.findIndex((r) => r.pubkey === pubkey);
    if (idx === -1) throw new Error("Merchant not found");
    records[idx] = { ...records[idx], status: "approved", approvedAt: new Date().toISOString() };
    record = records[idx];
    return records;
  });
  return record!;
}

export async function suspendMerchant(pubkey: string): Promise<MerchantRecord> {
  let record: MerchantRecord | undefined;
  await mutate<MerchantRecord[]>(MERCHANTS_KEY, [], (records) => {
    const idx = records.findIndex((r) => r.pubkey === pubkey);
    if (idx === -1) throw new Error("Merchant not found");
    records[idx] = { ...records[idx], status: "suspended" };
    record = records[idx];
    return records;
  });
  return record!;
}

export async function getApprovedMerchants(): Promise<MerchantRecord[]> {
  return (await readRegistry()).filter((r) => r.status === "approved");
}

export async function getPendingCount(): Promise<number> {
  return (await readRegistry()).filter((r) => r.status === "pending").length;
}

// ---- external signals submitted by approved merchants -----------------------

export async function readExternalSignals(): Promise<ExternalSignal[]> {
  return readJson<ExternalSignal[]>(SIGNALS_KEY, []);
}

// Append a submitted signal. The tier cap is enforced inside the same mutation
// as the write so concurrent submits cannot race past the cap (check and append
// are atomic per key).
export async function appendExternalSignal(signal: ExternalSignal, signalCap: number): Promise<void> {
  await mutate<ExternalSignal[]>(SIGNALS_KEY, [], (existing) => {
    if (existing.find((s) => s.id === signal.id)) throw new Error("Signal id already exists");
    const count = existing.filter((s) => s.merchantAgent === signal.merchantAgent).length;
    if (count >= signalCap) throw new Error("Signal cap reached");
    return [...existing, signal];
  });
}

// Only return signals whose merchant is currently approved. A suspended
// merchant's signals drop out of the catalog automatically.
export async function getApprovedExternalSignals(): Promise<ExternalSignal[]> {
  const [signals, approved] = await Promise.all([readExternalSignals(), getApprovedMerchants()]);
  const capByMerchant = new Map(approved.map((m) => [m.pubkey, m.signalCap]));
  // Newest first, then keep only up to each approved merchant's signal cap.
  const sorted = [...signals]
    .filter((s) => capByMerchant.has(s.merchantAgent))
    .sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""));
  const counts = new Map<string, number>();
  const out: ExternalSignal[] = [];
  for (const s of sorted) {
    const used = counts.get(s.merchantAgent) ?? 0;
    if (used >= (capByMerchant.get(s.merchantAgent) ?? 0)) continue;
    counts.set(s.merchantAgent, used + 1);
    out.push(s);
  }
  return out;
}

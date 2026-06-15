"use server";

import { purchase, getCatalog, readLedger, getReputation } from "@/lib/economy";
import { agentFromSeed } from "@/lib/identity";
import type { AlphaSignal, LedgerEntry, AgentReputation } from "@/lib/types";

// The dashboard acts as a buyer agent with its own stable identity.
const dashboardBuyer = agentFromSeed("buyer-dashboard");

export async function buySignal(signalId: string): Promise<{
  signal: AlphaSignal;
  entry: LedgerEntry;
  signatureValid: boolean;
}> {
  return purchase(signalId, dashboardBuyer.pubkey);
}

export async function refreshFeed(): Promise<{ ledger: LedgerEntry[]; reputation: AgentReputation[] }> {
  const [ledger, reputation] = await Promise.all([readLedger(), getReputation()]);
  return { ledger, reputation };
}

export async function getSignals(): Promise<AlphaSignal[]> {
  return getCatalog();
}

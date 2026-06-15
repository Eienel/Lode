"use server";

import { purchase, getCatalog, readLedger, getReputation, appendLedger } from "@/lib/economy";
import { agentFromSeed } from "@/lib/identity";
import { spawn } from "node:child_process";
import type { AlphaSignal, LedgerEntry, AgentReputation } from "@/lib/types";

const dashboardBuyer = agentFromSeed("buyer-dashboard");

// Mock payment buy — no wallet needed, works for anyone.
export async function buySignal(signalId: string): Promise<{
  signal: AlphaSignal;
  entry: LedgerEntry;
  signatureValid: boolean;
}> {
  return purchase(signalId, dashboardBuyer.pubkey);
}

// Real on-chain payment buy — buyer signs the tx client-side and passes the
// confirmed signature here. We record it in the ledger as a real Solana tx.
export async function buySignalOnChain(
  signalId: string,
  buyerPubkey: string,
  txSignature: string,
): Promise<{ signal: AlphaSignal; entry: LedgerEntry; signatureValid: boolean }> {
  // The actual SPL/SOL transfer already happened client-side via wallet-adapter.
  // We verify the signal seal and record the ledger entry here.
  const { signal, signatureValid } = await purchase(signalId, buyerPubkey);
  // Overwrite the synthetic mock tx ref with the real Solana signature.
  const realEntry: LedgerEntry = {
    buyerAgent: buyerPubkey,
    merchantAgent: signal.merchantAgent,
    signalId: signal.id,
    pair: signal.pair,
    amount: signal.priceUsdc,
    txRef: txSignature,
    backend: "solana",
    ts: new Date().toISOString(),
  };
  await appendLedger(realEntry);
  return { signal, entry: realEntry, signatureValid };
}

export async function refreshFeed(): Promise<{ ledger: LedgerEntry[]; reputation: AgentReputation[] }> {
  const [ledger, reputation] = await Promise.all([readLedger(), getReputation()]);
  return { ledger, reputation };
}

export async function getSignals(): Promise<AlphaSignal[]> {
  return getCatalog();
}

// Run a byreal-cli dry-run command and stream the output. The command must
// contain --dry-run and must NOT contain --confirm (hard rule: never auto-confirm).
export async function executeCommand(cmd: string): Promise<string> {
  if (!cmd.includes("--dry-run")) throw new Error("Only --dry-run commands are allowed here.");
  if (cmd.includes("--confirm")) throw new Error("--confirm is not allowed via this action.");

  const parts = cmd.replace(/^byreal-cli\s+/, "").split(/\s+/);
  return new Promise((resolve, reject) => {
    const child = spawn("byreal-cli", parts, { env: process.env });
    let out = "";
    let err = "";
    const timer = setTimeout(() => { child.kill(); reject(new Error("Command timed out after 30s")); }, 30_000);
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("close", () => {
      clearTimeout(timer);
      resolve(out || err);
    });
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
  });
}

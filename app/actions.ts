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
  return new Promise((resolve) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn("byreal-cli", parts, { env: process.env });
    } catch {
      resolve(dryRunFallback(cmd));
      return;
    }
    let out = "";
    let err = "";
    const timer = setTimeout(() => { child.kill(); resolve(dryRunFallback(cmd)); }, 30_000);
    child.stdout?.on("data", (d) => (out += d.toString()));
    child.stderr?.on("data", (d) => (err += d.toString()));
    child.on("close", (code) => {
      clearTimeout(timer);
      const result = out || err;
      // If cli not found or returned nothing useful, show a helpful fallback
      if (!result.trim() || code === 127) {
        resolve(dryRunFallback(cmd));
      } else {
        resolve(result);
      }
    });
    child.on("error", () => { clearTimeout(timer); resolve(dryRunFallback(cmd)); });
  });
}

function dryRunFallback(cmd: string): string {
  const posMatch = cmd.match(/--position\s+(\S+)/);
  const amtMatch = cmd.match(/--amount-usd\s+(\S+)/);
  const position = posMatch?.[1] ?? "unknown";
  const amount = amtMatch?.[1] ?? "250";

  return [
    "byreal-cli dry-run preview",
    "---",
    `command:    ${cmd}`,
    `position:   ${position}`,
    `amount:     $${amount} USD`,
    "",
    "note: byreal-cli is not available in this server environment.",
    "copy the command above and run it locally to get a live fee quote:",
    "",
    "  npm install -g @byreal-io/byreal-cli",
    "  byreal-cli setup",
    `  ${cmd}`,
    "",
    "the --confirm version is shown below when you are ready to open the position.",
  ].join("\n");
}

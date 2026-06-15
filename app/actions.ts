"use server";

import { purchase, getSignal, getCatalog, readLedger, getReputation, isTxUsed, recordOnChainPurchase } from "@/lib/economy";
import { agentFromSeed } from "@/lib/identity";
import { verifyPayment } from "@/lib/solana-verify";
import { spawn } from "node:child_process";
import type { AlphaSignal, LedgerEntry, AgentReputation } from "@/lib/types";

const dashboardBuyer = agentFromSeed("buyer-dashboard");

// Mock payment buy, no wallet needed, works for anyone.
export async function buySignal(signalId: string, forceMock?: boolean): Promise<{
  signal: AlphaSignal;
  entry: LedgerEntry;
  signatureValid: boolean;
}> {
  return purchase(signalId, dashboardBuyer.pubkey, forceMock);
}

async function fetchSolPrice(): Promise<number> {
  try {
    const res = await fetch("https://api2.byreal.io/byreal/api/dex/v2/mint/list?search=SOL&page=1&pageSize=5", { cache: "no-store" });
    const json = await res.json();
    const records: { mintInfo: { symbol: string }; price: string }[] = json?.result?.data?.records ?? [];
    const sol = records.find((r) => r.mintInfo.symbol === "SOL" || r.mintInfo.symbol === "WSOL");
    if (sol && Number(sol.price) > 10) return Number(sol.price);
  } catch {}
  return 140;
}

// Real on-chain payment buy. The buyer signs and sends the transfer client-side
// and passes the confirmed signature here. We do not trust it: the payment is
// verified on-chain (correct recipient, sufficient amount, not already used)
// before the signal is unlocked and recorded exactly once.
export async function buySignalOnChain(
  signalId: string,
  buyerPubkey: string,
  txSignature: string,
  forceMock?: boolean,
): Promise<{ signal: AlphaSignal; entry: LedgerEntry; signatureValid: boolean }> {
  const signal = await getSignal(signalId, forceMock);
  if (!signal) throw new Error("Signal not found");

  if (await isTxUsed(txSignature)) {
    throw new Error("This transaction was already used to unlock a signal");
  }

  const solPrice = await fetchSolPrice();
  const check = await verifyPayment(txSignature, signal.merchantAgent, signal.priceUsdc, solPrice);
  if (!check.ok) {
    throw new Error(`Payment verification failed: ${check.reason ?? "unknown"}`);
  }

  return recordOnChainPurchase(signal, buyerPubkey, txSignature);
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

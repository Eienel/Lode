// The marketplace and economy layer. Holds the catalog of mined signals (teaser
// public, full body locked), gates the full signal behind a payment, and appends
// every settled purchase to an on-disk ledger. That ledger is the evidence of a
// working agent-to-agent wallet economy.

import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { mineSignals, loadMerchant } from "./merchant";
import { hashPayload, verify } from "./identity";
import { getApprovedExternalSignals, readRegistry } from "./merchant-registry";
import type { AlphaSignal, LedgerEntry, AgentReputation } from "./types";

// Platform fee taken on each sale. Tracked in the ledger for display; the
// on-chain split is a v2 concern.
const PLATFORM_FEE_PCT = 0.2;

// Vercel only allows writes under /tmp; locally we keep a project data dir.
const DATA_DIR = process.env.LODE_DATA_DIR || (process.env.VERCEL ? path.join(os.tmpdir(), "lode") : path.join(process.cwd(), "data"));
const LEDGER_PATH = path.join(DATA_DIR, "ledger.json");

// ---- catalog (cached so we do not re-mine on every request) ----------------

let catalogCache: { at: number; signals: AlphaSignal[]; key: string } | null = null;
const CATALOG_TTL_MS = 5 * 60 * 1000;

export async function getCatalog(force = false, forceMock?: boolean): Promise<AlphaSignal[]> {
  const mockKey = forceMock ? "mock" : "live";
  if (!force && catalogCache?.key === mockKey && Date.now() - catalogCache.at < CATALOG_TTL_MS) {
    return catalogCache.signals;
  }
  const [lodeSignals, externalSignals] = await Promise.all([
    mineSignals(6, forceMock),
    getApprovedExternalSignals().catch(() => []),
  ]);
  const signals = [...lodeSignals, ...externalSignals];
  catalogCache = { at: Date.now(), signals, key: mockKey };
  return signals;
}

export async function getSignal(id: string): Promise<AlphaSignal | undefined> {
  return (await getCatalog()).find((s) => s.id === id);
}

// ---- payment backends ------------------------------------------------------

export interface Payment {
  pay(buyerAgent: string, amount: number, memo: string): Promise<{ txRef: string; backend: "mock" | "solana" }>;
}

// Mock backend: instant settlement with a deterministic synthetic reference.
class MockPayment implements Payment {
  async pay(buyerAgent: string, amount: number, memo: string) {
    const txRef = `mock_${hashPayload({ buyerAgent, amount, memo, t: Date.now() }).slice(0, 32)}`;
    return { txRef, backend: "mock" as const };
  }
}

// Solana backend: real SOL/SPL transfer, env-gated and optional. Kept off the
// demo path. Only wired when LODE_PAYMENT_BACKEND=solana and creds are present.
class SolanaPayment implements Payment {
  async pay(buyerAgent: string, amount: number, memo: string) {
    const rpc = process.env.SOLANA_RPC_URL;
    const secret = process.env.SOLANA_PRIVATE_KEY;
    if (!rpc || !secret) throw new Error("Solana payment requires SOLANA_RPC_URL and SOLANA_PRIVATE_KEY");
    // Lazy import so the demo never needs web3 on the request path.
    const web3 = await import("@solana/web3.js");
    const bs58 = (await import("bs58")).default;
    const conn = new web3.Connection(rpc, "confirmed");
    const payer = web3.Keypair.fromSecretKey(bs58.decode(secret));
    const merchant = new web3.PublicKey(loadMerchant().pubkey);
    const lamports = Math.round(amount * 1e6); // treat amount as a small SOL-denominated demo transfer
    const tx = new web3.Transaction().add(
      web3.SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: merchant, lamports }),
    );
    const sig = await web3.sendAndConfirmTransaction(conn, tx, [payer]);
    return { txRef: sig, backend: "solana" as const };
  }
}

export function getPayment(): Payment {
  return process.env.LODE_PAYMENT_BACKEND === "solana" ? new SolanaPayment() : new MockPayment();
}

// ---- ledger ----------------------------------------------------------------

export async function readLedger(): Promise<LedgerEntry[]> {
  try {
    const raw = await fs.readFile(LEDGER_PATH, "utf8");
    return JSON.parse(raw) as LedgerEntry[];
  } catch {
    return [];
  }
}

export async function appendLedger(entry: LedgerEntry): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const ledger = await readLedger();
  ledger.unshift(entry);
  await fs.writeFile(LEDGER_PATH, JSON.stringify(ledger, null, 2));
}

// ---- the purchase: verify signature, settle payment, release full signal ----

export interface PurchaseResult {
  signal: AlphaSignal; // full, unlocked
  entry: LedgerEntry;
  signatureValid: boolean;
}

export async function purchase(signalId: string, buyerAgent: string): Promise<PurchaseResult> {
  const signal = await getSignal(signalId);
  if (!signal) throw new Error("Signal not found");

  // The buyer verifies the seal before paying: recompute the payload hash and
  // check the merchant's signature over it.
  const recomputed = hashPayload({
    poolAddr: signal.poolAddr,
    pair: signal.pair,
    recommendedRange: signal.recommendedRange,
    estFeeApr: signal.estFeeApr,
    riskScore: signal.riskScore,
    copyTarget: signal.copyTarget,
    rationale: signal.rationale,
    confidence: signal.confidence,
  });
  const signatureValid = recomputed === signal.payloadHash && verify(signal.payloadHash, signal.signature, signal.merchantAgent);

  const payment = getPayment();
  const { txRef, backend } = await payment.pay(buyerAgent, signal.priceUsdc, signal.id);

  const entry: LedgerEntry = {
    buyerAgent,
    merchantAgent: signal.merchantAgent,
    signalId: signal.id,
    pair: signal.pair,
    amount: signal.priceUsdc,
    txRef,
    backend,
    ts: new Date().toISOString(),
    platformFee: Math.round(signal.priceUsdc * PLATFORM_FEE_PCT * 100) / 100,
  };
  await appendLedger(entry);

  return { signal, entry, signatureValid };
}

// ---- reputation derived from the ledger ------------------------------------

export async function getReputation(): Promise<AgentReputation[]> {
  const [ledger, registry] = await Promise.all([readLedger(), readRegistry().catch(() => [])]);
  const labelFor = (pubkey: string) => registry.find((r) => r.pubkey === pubkey)?.label ?? "Merchant";
  const map = new Map<string, AgentReputation>();
  const merchant = loadMerchant().pubkey;
  map.set(merchant, { agent: merchant, label: "Lode merchant", role: "merchant", sales: 0, revenue: 0 });
  for (const e of ledger) {
    const m = map.get(e.merchantAgent) ?? { agent: e.merchantAgent, label: labelFor(e.merchantAgent), role: "merchant" as const, sales: 0, revenue: 0 };
    m.sales += 1;
    m.revenue += e.amount;
    map.set(e.merchantAgent, m);
    const b = map.get(e.buyerAgent) ?? { agent: e.buyerAgent, label: shortLabel(e.buyerAgent), role: "buyer" as const, sales: 0, revenue: 0 };
    map.set(e.buyerAgent, b);
  }
  return [...map.values()];
}

function shortLabel(agent: string): string {
  return `Buyer ${agent.slice(0, 4)}`;
}

// Server-side verification of Base (EVM) USDC payments, the counterpart to
// lib/solana-verify.ts. A buyer agent can pay the signal price in USDC on Base
// (the x402 micropayment rail) instead of Solana. We never trust a client
// claim: we read the settled transaction on Base, confirm a USDC Transfer of at
// least the price landed in the treasury, and report the payer.
//
// Settle-where-paid: the signal unlocks the moment this verifies on Base. Funds
// stay on Base until a periodic CCTP sweep consolidates them to the Solana
// treasury (an ops job, not on the buyer's path). See README.
//
// Gated by env: BASE_RPC_URL and LODE_TREASURY_BASE must be set for the rail to
// be active. Without them the x402 route reports the rail as unconfigured.

import { decodeEventLog, parseAbiItem } from "viem";

// Native USDC on Base mainnet (6 decimals).
const BASE_USDC = (process.env.LODE_BASE_USDC ||
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913").toLowerCase();
const BASE_RPC = process.env.BASE_RPC_URL || "https://mainnet.base.org";
const BASE_CHAIN_ID = Number(process.env.BASE_CHAIN_ID || 8453);

const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

export interface BasePaymentCheck {
  ok: boolean;
  reason?: string;
  payer?: string;
  usdcAmount?: number; // whole USDC
}

export function baseRailConfigured(): boolean {
  return Boolean(process.env.LODE_TREASURY_BASE);
}

export function baseTreasury(): string | null {
  return process.env.LODE_TREASURY_BASE ?? null;
}

export function baseUsdcAddress(): string {
  return BASE_USDC;
}

export function baseNetwork(): { id: number; name: string } {
  return { id: BASE_CHAIN_ID, name: "base" };
}

// Verify that `txHash` is a confirmed Base transaction that transferred at least
// `minUsdc` of USDC to `recipient`.
export async function verifyBasePayment(
  txHash: string,
  recipient: string,
  minUsdc: number,
): Promise<BasePaymentCheck> {
  if (!txHash || typeof txHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return { ok: false, reason: "Missing or malformed transaction hash" };
  }
  if (!recipient || !/^0x[0-9a-fA-F]{40}$/.test(recipient)) {
    return { ok: false, reason: "Base treasury address not configured" };
  }

  const { createPublicClient, http } = await import("viem");
  const chain = {
    id: BASE_CHAIN_ID,
    name: "Base",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [BASE_RPC] } },
  } as const;
  const client = createPublicClient({ chain, transport: http(BASE_RPC) });

  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
  } catch {
    return { ok: false, reason: "Transaction not found or not confirmed" };
  }
  if (!receipt || receipt.status !== "success") {
    return { ok: false, reason: "Transaction failed or not confirmed on Base" };
  }

  const recip = recipient.toLowerCase();
  let total = 0n;
  let payer: string | undefined;

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== BASE_USDC) continue;
    try {
      const decoded = decodeEventLog({ abi: [TRANSFER_EVENT], data: log.data, topics: log.topics });
      if (decoded.eventName !== "Transfer") continue;
      const { from, to, value } = decoded.args as { from: string; to: string; value: bigint };
      if (to.toLowerCase() === recip) {
        total += value;
        payer = from;
      }
    } catch {
      // not a Transfer log we can decode; skip
    }
  }

  if (total === 0n) {
    return { ok: false, reason: "No USDC transfer to treasury found", payer };
  }
  const usdc = Number(total) / 1_000_000;
  if (usdc + 1e-6 >= minUsdc) {
    return { ok: true, payer, usdcAmount: usdc };
  }
  return { ok: false, reason: `USDC paid (${usdc}) below required ${minUsdc}`, payer, usdcAmount: usdc };
}

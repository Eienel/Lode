// Server-side verification of on-chain payments. The client signs and sends
// transfers with its own wallet, but the server must not trust a client-claimed
// signature: it confirms the transaction landed, moved enough value to the
// expected recipient, and has not already been used for another action.
//
// Used to gate merchant registration (must pay the fee) and signal purchases
// (must pay the price) before recording anything.

import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

// Allow SOL payments to undershoot the USD-converted target a little, since the
// client converts at a slightly different SOL price than we might read now.
const SOL_TOLERANCE = 0.9;

let conn: Connection | null = null;
function connection(): Connection {
  if (!conn) conn = new Connection(RPC, "confirmed");
  return conn;
}

export interface PaymentCheck {
  ok: boolean;
  reason?: string;
  payer?: string;
  usdcAmount?: number; // whole USDC
  solAmount?: number; // whole SOL
}

// Verify that `signature` is a confirmed transfer to `recipient` worth at least
// `minUsdc` (paid either in USDC, or in SOL converted at `solPrice`).
export async function verifyPayment(
  signature: string,
  recipient: string,
  minUsdc: number,
  solPrice: number,
): Promise<PaymentCheck> {
  if (!signature || typeof signature !== "string" || signature.length < 64) {
    return { ok: false, reason: "Missing or malformed signature" };
  }
  let recipientKey: PublicKey;
  try {
    recipientKey = new PublicKey(recipient);
  } catch {
    return { ok: false, reason: "Invalid recipient" };
  }

  let tx;
  try {
    tx = await connection().getParsedTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
  } catch {
    return { ok: false, reason: "Could not fetch transaction" };
  }
  if (!tx) return { ok: false, reason: "Transaction not found or not confirmed" };
  if (tx.meta?.err) return { ok: false, reason: "Transaction failed on-chain" };

  const payer = tx.transaction.message.accountKeys.find((k) => k.signer)?.pubkey.toBase58();

  // USDC path: compare token balance deltas for the recipient's USDC account.
  const pre = tx.meta?.preTokenBalances ?? [];
  const post = tx.meta?.postTokenBalances ?? [];
  const recipientOwner = recipientKey.toBase58();
  const usdcDelta = post
    .filter((b) => b.mint === USDC_MINT && b.owner === recipientOwner)
    .reduce((sum, b) => {
      const before = pre.find((p) => p.accountIndex === b.accountIndex);
      const beforeAmt = before ? Number(before.uiTokenAmount.amount) : 0;
      return sum + (Number(b.uiTokenAmount.amount) - beforeAmt);
    }, 0);
  if (usdcDelta > 0) {
    const usdc = usdcDelta / 1_000_000;
    if (usdc + 1e-6 >= minUsdc) {
      return { ok: true, payer, usdcAmount: usdc };
    }
    return { ok: false, reason: `USDC paid (${usdc}) below required ${minUsdc}`, payer, usdcAmount: usdc };
  }

  // SOL path: compare the recipient's native lamport balance delta.
  const keys = tx.transaction.message.accountKeys.map((k) => k.pubkey.toBase58());
  const idx = keys.indexOf(recipientOwner);
  if (idx >= 0 && tx.meta) {
    const lamportDelta = tx.meta.postBalances[idx] - tx.meta.preBalances[idx];
    if (lamportDelta > 0) {
      const sol = lamportDelta / LAMPORTS_PER_SOL;
      const requiredSol = (minUsdc / solPrice) * SOL_TOLERANCE;
      if (sol >= requiredSol) {
        return { ok: true, payer, solAmount: sol };
      }
      return { ok: false, reason: `SOL paid (${sol}) below required ${requiredSol.toFixed(4)}`, payer, solAmount: sol };
    }
  }

  return { ok: false, reason: "No qualifying transfer to recipient found", payer };
}

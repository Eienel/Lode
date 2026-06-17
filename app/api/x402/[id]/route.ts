import { NextResponse } from "next/server";
import { getSignal, isTxUsed, recordOnChainPurchase } from "@/lib/economy";
import {
  baseRailConfigured,
  baseTreasury,
  baseUsdcAddress,
  baseNetwork,
  verifyBasePayment,
} from "@/lib/base-verify";

// x402 micropayment rail for buyer agents paying in USDC on Base.
//
// Flow (HTTP 402 "Payment Required"):
//   GET /api/x402/:id
//     -> 402 with an `accepts` array describing the Base USDC payment required.
//   GET /api/x402/:id  with header  X-PAYMENT: <base64 or hex tx hash>
//     -> server verifies the settled USDC transfer on Base, unlocks the signal,
//        records the sale (backend "base"), returns 200 with the full signal.
//
// Settle-where-paid: the signal unlocks the instant the Base payment verifies.
// Funds are consolidated to the Solana treasury later via a CCTP sweep (ops job,
// off the buyer's path). The Solana wallet flow remains the default rail.

const X402_VERSION = 1;

// Parse the X-PAYMENT header. We accept either a raw 0x tx hash or a base64
// JSON payload carrying { txHash }. This keeps the rail simple and verifiable:
// the proof is a settled on-chain transaction we read back ourselves.
function parsePaymentHeader(header: string | null): string | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (/^0x[0-9a-fA-F]{64}$/.test(trimmed)) return trimmed;
  try {
    const json = JSON.parse(Buffer.from(trimmed, "base64").toString("utf8"));
    const tx = json.txHash ?? json.transaction ?? json.payload?.txHash;
    return typeof tx === "string" ? tx : null;
  } catch {
    return null;
  }
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const signal = await getSignal(params.id);
  if (!signal) {
    return NextResponse.json({ error: "Signal not found" }, { status: 404 });
  }

  if (!baseRailConfigured()) {
    return NextResponse.json(
      { error: "Base x402 rail is not configured. Set LODE_TREASURY_BASE and BASE_RPC_URL, or pay via the Solana flow." },
      { status: 501 },
    );
  }

  const treasury = baseTreasury()!;
  const atomic = Math.ceil(signal.priceUsdc * 1_000_000).toString();
  const resource = new URL(req.url).toString();

  const payHeader = parsePaymentHeader(req.headers.get("x-payment"));

  // No payment yet: respond with the 402 challenge.
  if (!payHeader) {
    return NextResponse.json(
      {
        x402Version: X402_VERSION,
        error: "X-PAYMENT header is required",
        accepts: [
          {
            scheme: "exact",
            network: baseNetwork().name,
            maxAmountRequired: atomic,
            resource,
            description: `Unlock Lode signal ${signal.id} (${signal.pair})`,
            mimeType: "application/json",
            payTo: treasury,
            maxTimeoutSeconds: 120,
            asset: baseUsdcAddress(),
            extra: { name: "USD Coin", decimals: 6 },
          },
        ],
      },
      { status: 402 },
    );
  }

  // Payment provided: verify it on Base before unlocking.
  if (await isTxUsed(payHeader)) {
    return NextResponse.json({ error: "This payment was already used to unlock a signal" }, { status: 409 });
  }

  const check = await verifyBasePayment(payHeader, treasury, signal.priceUsdc);
  if (!check.ok) {
    return NextResponse.json(
      { x402Version: X402_VERSION, error: `Payment not verified: ${check.reason ?? "unknown"}` },
      { status: 402 },
    );
  }

  const buyer = check.payer ?? "base-agent";
  const result = await recordOnChainPurchase(signal, buyer, payHeader, "base");

  return NextResponse.json(
    {
      x402Version: X402_VERSION,
      settled: { network: baseNetwork().name, asset: "USDC", amount: check.usdcAmount, txHash: payHeader, payer: check.payer },
      signal: result.signal, // full, unlocked alpha
      signatureValid: result.signatureValid,
    },
    { status: 200 },
  );
}

import { NextResponse } from "next/server";
import { findMerchant, appendExternalSignal, countSignalsForMerchant } from "@/lib/merchant-registry";
import { hashPayload, verify } from "@/lib/identity";
import type { AlphaSignal } from "@/lib/types";

// Approved merchants push pre-signed signals here. We verify the merchant is
// approved and that the seal matches before listing. The canonical payload must
// match the subset verified in lib/economy.ts purchase().
export async function POST(req: Request) {
  try {
    const { signal } = (await req.json()) as { signal: AlphaSignal };
    if (!signal?.id || !signal?.merchantAgent) {
      return NextResponse.json({ error: "Invalid signal" }, { status: 400 });
    }
    const merchant = await findMerchant(signal.merchantAgent);
    if (!merchant || merchant.status !== "approved") {
      return NextResponse.json({ error: "Merchant not approved" }, { status: 403 });
    }
    // Fast, friendly cap check. The authoritative check is atomic inside
    // appendExternalSignal so concurrent submits cannot race past the cap.
    const current = await countSignalsForMerchant(signal.merchantAgent);
    if (current >= merchant.signalCap) {
      return NextResponse.json(
        { error: `Signal cap reached (${merchant.signalCap}). Upgrade tier to list more.` },
        { status: 403 },
      );
    }
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
    const valid = recomputed === signal.payloadHash && verify(signal.payloadHash, signal.signature, signal.merchantAgent);
    if (!valid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
    await appendExternalSignal({ ...signal, submittedAt: new Date().toISOString() }, merchant.signalCap);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    if (msg.includes("already exists")) return NextResponse.json({ error: msg }, { status: 409 });
    if (msg.includes("cap reached")) return NextResponse.json({ error: msg }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

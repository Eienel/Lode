import { NextResponse } from "next/server";
import { registerMerchant } from "@/lib/merchant-registry";
import { verifyPayment } from "@/lib/solana-verify";
import { MERCHANT_TIERS, signalCapForTier } from "@/lib/types";

const TREASURY = process.env.NEXT_PUBLIC_LODE_TREASURY ?? "CHii3jRQguQHeNECGkBLnc3noaA68NC2fVc11yEN8QEv";

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

// Register a new merchant after verifying their fee payment landed on-chain.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { pubkey, label, bio, tx, tier } = body ?? {};
    if (!pubkey || !label || !bio || !tx) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (typeof pubkey !== "string" || pubkey.length < 32 || pubkey.length > 44) {
      return NextResponse.json({ error: "Invalid pubkey" }, { status: 400 });
    }
    const tierUsd = Number(tier);
    if (!MERCHANT_TIERS.some((t) => t.usd === tierUsd)) {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }

    // The registration fee must actually have been paid to the treasury. We do
    // not trust the client-supplied tx; we confirm it on-chain for the tier.
    const solPrice = await fetchSolPrice();
    const check = await verifyPayment(tx, TREASURY, tierUsd, solPrice);
    if (!check.ok) {
      return NextResponse.json({ error: `Fee payment not verified: ${check.reason ?? "unknown"}` }, { status: 402 });
    }

    const record = await registerMerchant({
      pubkey,
      label,
      bio,
      registrationTx: tx,
      tier: tierUsd,
      signalCap: signalCapForTier(tierUsd),
    });
    return NextResponse.json({ status: "pending", pubkey: record.pubkey, signalCap: record.signalCap });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Registration failed";
    if (msg.includes("already registered") || msg.includes("already used")) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { registerMerchant } from "@/lib/merchant-registry";

// Register a new merchant after their fee payment. v1 stores the tx as-is; v2
// will verify it on-chain via connection.getTransaction.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { pubkey, label, bio, tx } = body ?? {};
    if (!pubkey || !label || !bio || !tx) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (typeof pubkey !== "string" || pubkey.length < 32 || pubkey.length > 44) {
      return NextResponse.json({ error: "Invalid pubkey" }, { status: 400 });
    }
    const record = await registerMerchant({ pubkey, label, bio, registrationTx: tx });
    return NextResponse.json({ status: "pending", pubkey: record.pubkey });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Registration failed";
    if (msg.includes("already registered")) return NextResponse.json({ error: msg }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

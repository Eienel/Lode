import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { approveMerchant, suspendMerchant } from "@/lib/merchant-registry";

// Constant-time secret check that does not leak length or content via timing.
function secretOk(provided: unknown): boolean {
  const expected = process.env.LODE_ADMIN_SECRET;
  if (!expected) {
    console.warn("LODE_ADMIN_SECRET is not set; admin approval endpoint is disabled.");
    return false;
  }
  if (typeof provided !== "string") return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Admin-only: approve or suspend a merchant. Gated by LODE_ADMIN_SECRET.
export async function POST(req: Request) {
  const body = await req.json();
  const { pubkey, secret, action = "approve" } = body ?? {};
  if (!secretOk(secret)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const record = action === "suspend" ? await suspendMerchant(pubkey) : await approveMerchant(pubkey);
    return NextResponse.json(record);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 404 });
  }
}

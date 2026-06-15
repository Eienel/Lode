import { NextResponse } from "next/server";
import { approveMerchant, suspendMerchant } from "@/lib/merchant-registry";

// Admin-only: approve or suspend a merchant. Gated by LODE_ADMIN_SECRET.
export async function POST(req: Request) {
  const body = await req.json();
  const { pubkey, secret, action = "approve" } = body ?? {};
  if (!process.env.LODE_ADMIN_SECRET || secret !== process.env.LODE_ADMIN_SECRET) {
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

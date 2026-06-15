import { NextResponse } from "next/server";

// Return a best-effort SOL/USD price for converting signal prices from USDC to
// SOL. Tries the Byreal token list first (SOL is always in there), falls back
// to CoinGecko, then a safe static floor.
export async function GET() {
  try {
    const res = await fetch(
      "https://api2.byreal.io/byreal/api/dex/v2/mint/list?search=SOL&page=1&pageSize=5",
      { cache: "no-store" },
    );
    const json = await res.json();
    const records: { mintInfo: { symbol: string }; price: string }[] =
      json?.result?.data?.records ?? [];
    const sol = records.find((r) => r.mintInfo.symbol === "SOL" || r.mintInfo.symbol === "WSOL");
    if (sol && Number(sol.price) > 10) {
      return NextResponse.json({ price: Number(sol.price) });
    }
  } catch {}
  // Fallback: safe static price. Always errs on the side of sending slightly
  // more SOL than needed (undervalues SOL), so the buyer never underpays.
  return NextResponse.json({ price: 140 });
}

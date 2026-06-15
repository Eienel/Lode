// Live Byreal data over HTTP. The byreal-cli talks to api2.byreal.io under the
// hood; we call the same endpoints directly so the hosted app can serve live
// data without spawning a CLI in a serverless function. Raw responses are mapped
// to the same normalized shapes the CLI emits with -o json.

import type { Pool, Overview, TopPosition } from "./types";

const BASE = "https://api2.byreal.io/byreal/api/dex/v2";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { accept: "application/json" }, cache: "no-store" });
  const json = await res.json();
  if (json.retCode !== 0 || !json.result?.data) throw new Error(`byreal api error: ${json.retMsg || res.status}`);
  return json.result.data as T;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json = await res.json();
  if (json.retCode !== 0 || !json.result?.data) throw new Error(`byreal api error: ${json.retMsg || res.status}`);
  return json.result.data as T;
}

interface RawMint {
  mintInfo: { address: string; symbol: string; name: string; decimals: number; logoURI?: string };
  price: string;
}
interface RawPool {
  poolAddress: string;
  mintA: RawMint;
  mintB: RawMint;
  feeRate: { fixFeeRate: string };
  price: string;
  priceChange1h: string;
  priceChange1d: string;
  priceChange7d: string;
  tvl: string;
  volumeUsd24h: string;
  volumeUsd7d: string;
  feeUsd24h: string;
  feeApr24h: string;
  totalBonus: string;
}

const n = (s: string) => parseFloat(s);

function mapPool(r: RawPool): Pool {
  const mint = (m: RawMint) => ({
    mint: m.mintInfo.address,
    symbol: m.mintInfo.symbol,
    name: m.mintInfo.name,
    decimals: m.mintInfo.decimals,
    logo_uri: m.mintInfo.logoURI,
    price_usd: n(m.price),
  });
  const apr = n(r.feeApr24h) * 100; // api returns a fraction
  return {
    id: r.poolAddress,
    pair: `${r.mintA.mintInfo.symbol}/${r.mintB.mintInfo.symbol}`,
    token_a: mint(r.mintA),
    token_b: mint(r.mintB),
    tvl_usd: n(r.tvl),
    volume_24h_usd: n(r.volumeUsd24h),
    volume_7d_usd: n(r.volumeUsd7d),
    fee_rate_bps: n(r.feeRate.fixFeeRate) / 100,
    fee_24h_usd: n(r.feeUsd24h),
    apr,
    reward_apr: 0,
    total_apr: apr,
    current_price: n(r.price),
    price_change_1h: n(r.priceChange1h) * 100,
    price_change_24h: n(r.priceChange1d) * 100,
    price_change_7d: n(r.priceChange7d) * 100,
  };
}

export async function apiPoolsList(): Promise<Pool[]> {
  const data = await get<{ records: RawPool[] }>("/pools/info/list?page=1&pageSize=50");
  return data.records.map(mapPool).sort((a, b) => b.total_apr - a.total_apr);
}

export async function apiOverview(): Promise<Overview> {
  const d = await get<{
    tvl: string;
    tvlChange: string;
    volumeUsd24h: string;
    volumeUsd24hChange: string;
    feeUsd24h: string;
  }>("/overview/global");
  return {
    tvl: n(d.tvl),
    tvl_change_24h: n(d.tvlChange),
    volume_24h_usd: n(d.volumeUsd24h),
    volume_change_24h: n(d.volumeUsd24hChange),
    fee_24h_usd: n(d.feeUsd24h),
    pools_count: 0,
  };
}

interface RawTop {
  poolAddress: string;
  positionAddress: string;
  nftMintAddress: string;
  walletAddress: string;
  lowerTick: number;
  upperTick: number;
  liquidityUsd: string;
  earnedUsd: string;
  pnlUsd: string;
  copies: number;
  status: number;
}

// CLMM price from tick, adjusted for the token decimal difference.
function tickToPrice(tick: number, decA: number, decB: number): number {
  return Math.pow(1.0001, tick) * Math.pow(10, decA - decB);
}

export async function apiTopPositions(pool: Pool): Promise<TopPosition[]> {
  const data = await post<{ records: RawTop[] }>("/copyfarmer/top-positions", {
    poolAddress: pool.id,
    page: 1,
    pageSize: 5,
  });
  return data.records.map((r) => ({
    poolAddress: r.poolAddress,
    positionAddress: r.positionAddress,
    nftMintAddress: r.nftMintAddress,
    walletAddress: r.walletAddress,
    liquidityUsd: r.liquidityUsd,
    earnedUsd: r.earnedUsd,
    pnlUsd: r.pnlUsd,
    copies: r.copies,
    pair: pool.pair,
    inRange: r.status === 0,
    priceLower: tickToPrice(r.lowerTick, pool.token_a.decimals, pool.token_b.decimals).toFixed(8),
    priceUpper: tickToPrice(r.upperTick, pool.token_a.decimals, pool.token_b.decimals).toFixed(8),
  }));
}

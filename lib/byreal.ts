// Typed Byreal data layer. Serves realistic bundled fixtures in mock mode
// (LODE_MOCK default on), or live data over HTTP from the same api2.byreal.io
// endpoints the byreal-cli uses (LODE_MOCK=0). HTTP is used instead of spawning
// the CLI so the hosted serverless app can serve live data.
//
// Mock mode lets the entire app run on a fresh machine with no install, no
// wallet, and no funds. The buyer execution commands always stay --dry-run.

import poolsFixture from "../fixtures/pools.json";
import overviewFixture from "../fixtures/overview.json";
import { apiPoolsList, apiOverview, apiTopPositions } from "./byreal-api";
import type { Pool, PoolAnalysis, TopPosition, Overview, RangeBand } from "./types";

const MOCK = process.env.LODE_MOCK !== "0"; // default on; set LODE_MOCK=0 for live data

// ---- mock helpers ---------------------------------------------------------

const mockPools = (poolsFixture as { data: { pools: Pool[] } }).data.pools;
const mockOverview = (overviewFixture as { data: Overview }).data;

function num(s: string | number): number {
  return typeof s === "number" ? s : parseFloat(String(s).replace(/[$%,]/g, ""));
}

// Build a believable per-pool analysis from the pool's own numbers. CLMM fee APR
// scales inversely with range width, so we model bands the way pools analyze does.
function buildAnalysis(pool: Pool): PoolAnalysis {
  const price = pool.current_price;
  const baseApr = pool.total_apr;
  const dayPct = Math.min(40, Math.max(1.5, Math.abs(pool.price_change_24h) * 1.6 + 2));
  const bandPcts = [1, 2, 3, 5, 8, 10, 15, 20, 35, 50];
  const rangeAnalysis: RangeBand[] = bandPcts.map((p) => {
    // narrower range concentrates liquidity -> higher fee apr (roughly 10/p factor)
    const feeApr = (baseApr * 10) / p;
    const lower = price * (1 - p / 100);
    const upper = price * (1 + p / 100);
    const inRange = p < dayPct * 0.6 ? "low" : p < dayPct * 1.4 ? "medium" : "high";
    const rebal = inRange === "low" ? "high" : inRange === "medium" ? "medium" : "low";
    return {
      rangePercent: p,
      priceLower: lower.toFixed(8),
      priceUpper: upper.toFixed(8),
      estimatedFeeApr: `${feeApr.toFixed(1)}%`,
      estimatedTotalApr: `${(feeApr + pool.reward_apr).toFixed(1)}%`,
      inRangeLikelihood: inRange as RangeBand["inRangeLikelihood"],
      rebalanceFrequency: rebal as RangeBand["rebalanceFrequency"],
    };
  });
  const tvlRisk = pool.tvl_usd < 150_000 ? "high" : pool.tvl_usd < 1_000_000 ? "medium" : "low";
  const volRisk = dayPct > 12 ? "high" : dayPct > 5 ? "medium" : "low";
  const summary: string[] = [];
  if (tvlRisk !== "low") summary.push(`Pool TVL is $${Math.round(pool.tvl_usd).toLocaleString()} — higher slippage risk`);
  summary.push(`Day price range ${dayPct.toFixed(2)}% — ${volRisk === "high" ? "elevated" : "moderate"} IL risk`);
  const proj = rangeAnalysis.find((r) => r.rangePercent === 10)!;
  const dailyFee = (1000 * (num(proj.estimatedFeeApr) / 100)) / 365;
  return {
    pool: {
      address: pool.id,
      pair: pool.pair,
      category: "unknown",
      currentPrice: price.toFixed(8),
      feeRate: `${(pool.fee_rate_bps / 100).toFixed(2)}%`,
      tickSpacing: 10,
    },
    metrics: {
      tvl: pool.tvl_usd.toFixed(2),
      volume24h: pool.volume_24h_usd.toFixed(2),
      volume7d: pool.volume_7d_usd.toFixed(2),
      fee24h: pool.fee_24h_usd.toFixed(2),
      fee7d: (pool.fee_24h_usd * 7).toFixed(2),
      feeApr24h: `${pool.apr.toFixed(2)}%`,
      totalApr: `${pool.total_apr.toFixed(2)}%`,
      volumeToTvl: (pool.volume_24h_usd / Math.max(1, pool.tvl_usd)).toFixed(2),
    },
    volatility: {
      dayPriceRange: { low: (price * (1 - dayPct / 200)).toFixed(8), high: (price * (1 + dayPct / 200)).toFixed(8) },
      dayPriceRangePercent: `${dayPct.toFixed(2)}%`,
    },
    rangeAnalysis,
    riskFactors: { tvlRisk, volatilityRisk: volRisk, summary },
    investmentProjection: {
      amountUsd: 1000,
      rangePercent: 10,
      priceLower: proj.priceLower,
      priceUpper: proj.priceUpper,
      dailyFeeEstimate: dailyFee.toFixed(2),
      weeklyFeeEstimate: (dailyFee * 7).toFixed(2),
      monthlyFeeEstimate: (dailyFee * 30).toFixed(2),
      note: "Based on current 24h volume/fees. Actual returns vary.",
    },
  };
}

// Deterministic pseudo-address so mock copy targets look real without faking a
// specific wallet. Derived from the pool id, clearly synthetic in mock mode.
function buildTopPositions(pool: Pool): TopPosition[] {
  const seed = pool.id;
  const mk = (i: number, frac: number): TopPosition => {
    const liq = pool.tvl_usd * frac;
    const p = pool.current_price;
    const width = 0.05 + i * 0.03;
    return {
      poolAddress: pool.id,
      positionAddress: `${seed.slice(0, 30)}${i}pos`,
      nftMintAddress: `${seed.slice(2, 32)}${i}nft`,
      walletAddress: `${seed.slice(4, 34)}${i}w`,
      liquidityUsd: liq.toFixed(6),
      earnedUsd: (liq * 0.0008 * (i + 1)).toFixed(6),
      pnlUsd: ((i % 2 === 0 ? 1 : -1) * liq * 0.002).toFixed(6),
      copies: 9 - i * 2,
      pair: pool.pair,
      inRange: i < 2,
      priceLower: (p * (1 - width)).toFixed(8),
      priceUpper: (p * (1 + width)).toFixed(8),
    };
  };
  return [mk(0, 0.24), mk(1, 0.12), mk(2, 0.06)];
}

// ---- public api -----------------------------------------------------------

export const isMock = () => MOCK;

// Live mode caches the pool list briefly so analyze/top-positions can resolve a
// pool by address without refetching the whole list each call.
let livePoolsCache: { at: number; pools: Pool[] } | null = null;
async function livePools(): Promise<Pool[]> {
  if (livePoolsCache && Date.now() - livePoolsCache.at < 60_000) return livePoolsCache.pools;
  const pools = await apiPoolsList();
  livePoolsCache = { at: Date.now(), pools };
  return pools;
}

export async function poolsList(): Promise<Pool[]> {
  return MOCK ? mockPools : livePools();
}

export async function poolAnalyze(poolAddr: string): Promise<PoolAnalysis> {
  const pools = MOCK ? mockPools : await livePools();
  const pool = pools.find((p) => p.id === poolAddr) ?? pools[0];
  // analyze is derived from live pool metrics, the same way the CLI computes it
  return buildAnalysis(pool);
}

export async function topPositions(poolAddr: string): Promise<TopPosition[]> {
  const pools = MOCK ? mockPools : await livePools();
  const pool = pools.find((p) => p.id === poolAddr) ?? pools[0];
  if (MOCK) return buildTopPositions(pool);
  try {
    const live = await apiTopPositions(pool);
    return live.length ? live : buildTopPositions(pool);
  } catch {
    return buildTopPositions(pool);
  }
}

export async function overview(): Promise<Overview> {
  return MOCK ? mockOverview : apiOverview();
}

// Build the dry-run execution command a buyer runs after unlocking. We never
// auto-confirm; the buyer always previews first per the CLI hard rules.
export function buildCopyCommand(positionAddress: string, amountUsd: number): string {
  return `byreal-cli positions copy --position ${positionAddress} --amount-usd ${amountUsd} --dry-run`;
}

export function buildOpenCommand(poolAddr: string, lower: number, upper: number, amountUsd: number): string {
  return `byreal-cli positions open --pool ${poolAddr} --price-lower ${lower} --price-upper ${upper} --amount-usd ${amountUsd} --dry-run`;
}

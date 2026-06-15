// Typed wrapper around byreal-cli. Spawns the CLI with `-o json` and parses the
// result, or serves realistic bundled fixtures in mock mode (LODE_MOCK=1).
//
// Mock mode lets the entire app run on a fresh machine with no install, no
// wallet, and no funds, which is how the demo runs. Real mode shells out to the
// installed CLI for live Byreal data.

import { spawn } from "node:child_process";
import poolsFixture from "../fixtures/pools.json";
import overviewFixture from "../fixtures/overview.json";
import type { Pool, PoolAnalysis, TopPosition, Overview, RangeBand } from "./types";

const MOCK = process.env.LODE_MOCK !== "0"; // default on; set LODE_MOCK=0 for live CLI

export class WalletNotConfiguredError extends Error {
  constructor() {
    super("WALLET_NOT_CONFIGURED");
    this.name = "WalletNotConfiguredError";
  }
}

interface CliEnvelope<T> {
  success: boolean;
  data: T;
  error?: { code?: string; message?: string };
}

function runCli<T>(args: string[]): Promise<T> {
  return new Promise((resolve, reject) => {
    const child = spawn("byreal-cli", [...args, "-o", "json", "--non-interactive"], {
      env: process.env,
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", (e) => reject(e));
    child.on("close", () => {
      try {
        const parsed = JSON.parse(out) as CliEnvelope<T>;
        if (!parsed.success) {
          if (parsed.error?.code === "WALLET_NOT_CONFIGURED" || /WALLET_NOT_CONFIGURED/.test(out + err)) {
            return reject(new WalletNotConfiguredError());
          }
          return reject(new Error(parsed.error?.message || "byreal-cli failed"));
        }
        resolve(parsed.data);
      } catch {
        if (/WALLET_NOT_CONFIGURED/.test(out + err)) return reject(new WalletNotConfiguredError());
        reject(new Error(`Could not parse byreal-cli output: ${err || out}`.slice(0, 400)));
      }
    });
  });
}

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

export async function poolsList(): Promise<Pool[]> {
  if (MOCK) return mockPools;
  const data = await runCli<{ pools: Pool[] }>(["pools", "list", "--sort-field", "apr24h"]);
  return data.pools;
}

export async function poolAnalyze(poolAddr: string): Promise<PoolAnalysis> {
  if (MOCK) {
    const pool = mockPools.find((p) => p.id === poolAddr) ?? mockPools[0];
    return buildAnalysis(pool);
  }
  return runCli<PoolAnalysis>(["pools", "analyze", poolAddr]);
}

export async function topPositions(poolAddr: string): Promise<TopPosition[]> {
  if (MOCK) {
    const pool = mockPools.find((p) => p.id === poolAddr) ?? mockPools[0];
    return buildTopPositions(pool);
  }
  const data = await runCli<{ positions: TopPosition[] }>(["positions", "top-positions", "--pool", poolAddr]);
  return data.positions;
}

export async function overview(): Promise<Overview> {
  if (MOCK) return mockOverview;
  return runCli<Overview>(["overview"]);
}

// Build the dry-run execution command a buyer runs after unlocking. We never
// auto-confirm; the buyer always previews first per the CLI hard rules.
export function buildCopyCommand(positionAddress: string, amountUsd: number): string {
  return `byreal-cli positions copy --position ${positionAddress} --amount-usd ${amountUsd} --dry-run`;
}

export function buildOpenCommand(poolAddr: string, lower: number, upper: number, amountUsd: number): string {
  return `byreal-cli positions open --pool ${poolAddr} --price-lower ${lower} --price-upper ${upper} --amount-usd ${amountUsd} --dry-run`;
}

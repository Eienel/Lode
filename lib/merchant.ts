// The merchant agent pipeline. It mines Byreal for the best pools, analyzes each,
// finds top farmers, asks claude-sonnet-4-6 to synthesize a ranked recommendation,
// then seals the result by hashing and signing it with the merchant's ed25519
// identity. Output is a teaser (free) plus a locked full signal priced in USDC.

import { poolsList, poolAnalyze, topPositions } from "./byreal";
import { synthesize } from "./anthropic";
import { loadMerchant, hashPayload, sign } from "./identity";
import { buildCopyCommand, buildOpenCommand } from "./byreal";
import type { AlphaSignal, ListedSignal, Pool, RangeBand } from "./types";

const num = (s: string | number) => (typeof s === "number" ? s : parseFloat(String(s).replace(/[$%,]/g, "")));

// Pick the band that best balances fee yield against staying in range. We prefer
// the highest est fee APR among bands that are not "low" likelihood, falling back
// to the widest band if the pool is too hot for any safe band.
function chooseBand(bands: RangeBand[]): RangeBand {
  const safe = bands.filter((b) => b.inRangeLikelihood !== "low");
  const pool = safe.length ? safe : bands;
  return pool.reduce((best, b) => (num(b.estimatedFeeApr) > num(best.estimatedFeeApr) ? b : best), pool[0]);
}

function riskScore(pool: Pool, dayRangePct: number, tvlRisk: string): number {
  const tvlComponent = tvlRisk === "high" ? 40 : tvlRisk === "medium" ? 22 : 8;
  const volComponent = Math.min(45, dayRangePct * 2.2);
  return Math.round(Math.min(100, tvlComponent + volComponent));
}

// Price the signal: more confident, higher-yield, lower-risk alpha costs more.
function priceSignal(estFeeApr: number, confidence: number, risk: number): number {
  const base = 2 + (estFeeApr / 100) * 1.5 * confidence;
  const adj = base * (1 - risk / 300);
  return Math.max(1.5, Math.round(adj * 100) / 100);
}

async function buildSignal(pool: Pool, merchantPubkey: string, forceMock?: boolean): Promise<AlphaSignal> {
  const analysis = await poolAnalyze(pool.id, forceMock);
  const top = (await topPositions(pool.id, forceMock))[0] ?? null;
  const band = chooseBand(analysis.rangeAnalysis);
  const estFeeApr = num(band.estimatedFeeApr);
  const lower = num(band.priceLower);
  const upper = num(band.priceUpper);
  const dayRangePct = num(analysis.volatility.dayPriceRangePercent);
  const risk = riskScore(pool, dayRangePct, analysis.riskFactors.tvlRisk);

  const synth = await synthesize({
    analysis,
    chosen: { rangePercent: band.rangePercent, lower, upper, estFeeApr },
    top,
  });

  const copyTarget = top
    ? {
        walletAddress: top.walletAddress,
        positionAddress: top.positionAddress,
        liquidityUsd: num(top.liquidityUsd),
        copies: top.copies,
      }
    : null;

  const execCommand = copyTarget
    ? buildCopyCommand(copyTarget.positionAddress, 250)
    : buildOpenCommand(pool.id, lower, upper, 250);

  // The sealed payload is exactly what the buyer pays for and can verify.
  const payload = {
    poolAddr: pool.id,
    pair: pool.pair,
    recommendedRange: { lower, upper, rangePercent: band.rangePercent },
    estFeeApr,
    riskScore: risk,
    copyTarget,
    rationale: synth.rationale,
    confidence: synth.confidence,
  };
  const payloadHash = hashPayload(payload);
  const merchant = loadMerchant();
  const signature = sign(payloadHash, merchant);

  const priceUsdc = priceSignal(estFeeApr, synth.confidence, risk);

  return {
    id: `sig_${pool.id.slice(0, 8)}`,
    poolAddr: pool.id,
    pair: pool.pair,
    tokenALogo: pool.token_a.logo_uri,
    tokenBLogo: pool.token_b.logo_uri,
    currentPrice: pool.current_price,
    recommendedRange: { lower, upper, rangePercent: band.rangePercent },
    estFeeApr,
    riskScore: risk,
    copyTarget,
    rationale: synth.rationale,
    teaser: synth.teaser,
    confidence: synth.confidence,
    priceUsdc,
    inRangeLikelihood: band.inRangeLikelihood,
    execCommand,
    merchantAgent: merchantPubkey,
    payloadHash,
    signature,
    createdAt: new Date().toISOString(),
  };
}

// Mine N signals, ranked by a yield-adjusted-for-risk-and-confidence score.
export async function mineSignals(limit = 6, forceMock?: boolean): Promise<AlphaSignal[]> {
  const merchant = loadMerchant();
  const pools = (await poolsList(forceMock))
    .filter((p) => p.tvl_usd > 20_000 && p.total_apr > 0)
    .slice(0, limit + 4);

  const signals: AlphaSignal[] = [];
  for (const pool of pools) {
    try {
      signals.push(await buildSignal(pool, merchant.pubkey, forceMock));
    } catch {
      // skip pools that fail to analyze
    }
    if (signals.length >= limit) break;
  }

  return signals.sort(
    (a, b) => b.estFeeApr * b.confidence * (1 - b.riskScore / 200) - a.estFeeApr * a.confidence * (1 - a.riskScore / 200),
  );
}

// Strip a signal down to its public, pre-purchase form.
export function toListed(s: AlphaSignal): ListedSignal {
  return {
    ...s,
    rationale: undefined as never,
    locked: true,
    recommendedRange: null,
    copyTarget: null,
    execCommand: undefined as never,
  } as ListedSignal;
}

export { loadMerchant };

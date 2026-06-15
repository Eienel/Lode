// Anthropic synthesis for the merchant agent. Given on-chain pool analysis and
// top-farmer positions, claude-sonnet-4-6 writes the plain english rationale and
// teaser. Falls back to a deterministic local synthesizer when no API key is set
// so the demo runs offline.

import Anthropic from "@anthropic-ai/sdk";
import type { PoolAnalysis, TopPosition } from "./types";

const MODEL = "claude-sonnet-4-6";

export interface Synthesis {
  rationale: string;
  teaser: string;
  confidence: number;
}

interface SynthInput {
  analysis: PoolAnalysis;
  chosen: { rangePercent: number; lower: number; upper: number; estFeeApr: number };
  top: TopPosition | null;
}

export async function synthesize(input: SynthInput): Promise<Synthesis> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return localSynthesis(input);
  try {
    const client = new Anthropic({ apiKey: key });
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 600,
      system:
        "You are Lode, an autonomous merchant agent that mines Byreal CLMM alpha and sells it to other agents. " +
        "Write in calm, editorial, plain english. Sentence case. No em dashes, no italics, no hype, no emoji. " +
        "Return strict JSON only.",
      messages: [
        {
          role: "user",
          content:
            "Given this Byreal pool analysis and chosen LP range, produce JSON with keys " +
            '"rationale" (3 to 4 sentences explaining why this pool and range are attractive and the main risk), ' +
            '"teaser" (one sentence free preview that sells the signal without revealing the exact range or copy target), ' +
            'and "confidence" (number 0 to 1).\n\n' +
            JSON.stringify({
              pair: input.analysis.pool.pair,
              metrics: input.analysis.metrics,
              volatility: input.analysis.volatility,
              chosenRange: input.chosen,
              risk: input.analysis.riskFactors,
              copyTarget: input.top
                ? { liquidityUsd: input.top.liquidityUsd, copies: input.top.copies, inRange: input.top.inRange }
                : null,
            }),
        },
      ],
    });
    const text = msg.content.filter((c) => c.type === "text").map((c) => (c as { text: string }).text).join("");
    const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    return {
      rationale: String(json.rationale),
      teaser: String(json.teaser),
      confidence: Math.max(0, Math.min(1, Number(json.confidence) || 0.6)),
    };
  } catch {
    return localSynthesis(input);
  }
}

function localSynthesis({ analysis, chosen, top }: SynthInput): Synthesis {
  const pair = analysis.pool.pair;
  const vol = analysis.volatility.dayPriceRangePercent;
  const apr = chosen.estFeeApr.toFixed(0);
  const v2t = analysis.metrics.volumeToTvl;
  const tvlRisk = analysis.riskFactors.tvlRisk;
  const rationale =
    `${pair} is turning over ${v2t}x of its liquidity each day, which is what funds the fee yield here. ` +
    `A ${chosen.rangePercent}% band around the current price targets about ${apr}% fee APR while keeping the position in range against a ${vol} daily swing. ` +
    (top
      ? `A top farmer is running $${Math.round(Number(top.liquidityUsd)).toLocaleString()} in a similar band with ${top.copies} copiers, so the structure is already being mirrored. `
      : "") +
    `Main risk is ${tvlRisk === "high" ? "thin liquidity depth" : "moderate liquidity depth"}, so size entries to the book rather than chasing fills.`;
  const teaser = `${pair} is paying real fees on heavy turnover. Lode has mapped the exact band and a farmer worth copying.`;
  const confidence = Math.max(0.45, Math.min(0.92, 0.5 + Number(v2t) / 20 - (tvlRisk === "high" ? 0.12 : 0)));
  return { rationale, teaser, confidence };
}

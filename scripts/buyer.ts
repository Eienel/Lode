// Headless buyer agent. Browses the Lode catalog, ranks signals by yield adjusted
// for risk and confidence, verifies the merchant's seal, pays for the best one,
// receives the unlocked signal, and prints the ready-to-run dry-run command. This
// is the full agent-to-agent loop and the spine of the demo.

import { getCatalog, purchase, readLedger } from "../lib/economy";
import { agentFromSeed } from "../lib/identity";

const c = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  accent: (s: string) => `\x1b[38;5;130m${s}\x1b[0m`,
  good: (s: string) => `\x1b[38;5;64m${s}\x1b[0m`,
  rule: () => console.log(c.dim("─".repeat(64))),
};

async function main() {
  const buyer = agentFromSeed(`buyer-${process.argv[2] || "scout"}`);

  console.log();
  console.log(c.bold("Lode buyer agent"));
  console.log(c.dim(`identity ${buyer.pubkey}`));
  c.rule();

  console.log(c.bold("\n1. Browsing the alpha catalog"));
  const catalog = await getCatalog();
  catalog.forEach((s, i) => {
    console.log(
      `  ${i + 1}. ${c.accent(s.pair.padEnd(14))} est fee apr ${c.good(s.estFeeApr.toFixed(0) + "%")}  ` +
        `risk ${s.riskScore}  conf ${(s.confidence * 100).toFixed(0)}%  ${c.dim("$" + s.priceUsdc + " usdc")}`,
    );
  });

  // rank by yield adjusted for risk and confidence
  const ranked = [...catalog].sort(
    (a, b) => b.estFeeApr * b.confidence * (1 - b.riskScore / 200) - a.estFeeApr * a.confidence * (1 - a.riskScore / 200),
  );
  const pick = ranked[0];

  console.log(c.bold("\n2. Ranking by roi adjusted for risk"));
  console.log(`  best pick is ${c.accent(pick.pair)} at $${pick.priceUsdc} usdc`);
  console.log(`  teaser: ${c.dim(pick.teaser)}`);

  console.log(c.bold("\n3. Paying the merchant and unlocking"));
  const result = await purchase(pick.id, buyer.pubkey);
  console.log(`  seal verified: ${result.signatureValid ? c.good("yes, signature valid") : "no"}`);
  console.log(`  payment ${result.entry.backend} tx ${result.entry.txRef}`);
  console.log(`  paid to merchant ${result.signal.merchantAgent}`);

  const s = result.signal;
  console.log(c.bold("\n4. Unsealed signal"));
  console.log(`  pool          ${s.poolAddr}`);
  console.log(`  range         ${s.recommendedRange.lower.toFixed(6)} to ${s.recommendedRange.upper.toFixed(6)} (${s.recommendedRange.rangePercent}%)`);
  console.log(`  est fee apr   ${c.good(s.estFeeApr.toFixed(1) + "%")}`);
  if (s.copyTarget) console.log(`  copy farmer   ${s.copyTarget.walletAddress} ($${Math.round(s.copyTarget.liquidityUsd).toLocaleString()}, ${s.copyTarget.copies} copies)`);
  console.log(`  rationale     ${s.rationale}`);

  console.log(c.bold("\n5. Ready-to-run execution (dry-run, always preview first)"));
  console.log(`  ${c.accent(s.execCommand)}`);

  console.log(c.bold("\n6. Economy ledger"));
  const ledger = await readLedger();
  ledger.slice(0, 5).forEach((e) => {
    console.log(`  ${c.dim(new Date(e.ts).toISOString())}  ${e.pair.padEnd(12)} $${e.amount}  ${e.backend}  ${c.dim(e.txRef.slice(0, 20))}`);
  });
  c.rule();
  console.log(c.good("\nA2A loop complete: mine, seal, pay, unlock, execute, settle.\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

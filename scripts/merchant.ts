// Standalone merchant run: mine and seal signals, print the catalog. Useful for
// confirming the pipeline outside the dashboard.

import { mineSignals, loadMerchant } from "../lib/merchant";

async function main() {
  const merchant = loadMerchant();
  console.log(`\nLode merchant agent\nidentity ${merchant.pubkey}\n`);
  const signals = await mineSignals(6);
  for (const s of signals) {
    console.log(`${s.pair}  est fee apr ${s.estFeeApr.toFixed(0)}%  risk ${s.riskScore}  conf ${(s.confidence * 100).toFixed(0)}%  $${s.priceUsdc}`);
    console.log(`  sealed ${s.payloadHash.slice(0, 24)} sig ${s.signature.slice(0, 24)}`);
  }
  console.log(`\n${signals.length} signals sealed and listed.\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

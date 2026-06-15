// Register the Lode merchant agent's identity on Mantle (ERC-8004). Runs in
// simulated mode unless LODE_MANTLE=1 with MANTLE_PRIVATE_KEY and MANTLE_REGISTRY.

import { registerOnMantle } from "../lib/mantle";
import { loadMerchant } from "../lib/merchant";

async function main() {
  const merchant = loadMerchant();
  console.log(`\nRegistering Lode merchant on Mantle (ERC-8004)`);
  console.log(`solana DID  ${merchant.pubkey}`);
  const id = await registerOnMantle(merchant.pubkey, "lode-merchant");
  console.log(`status      ${id.status}`);
  console.log(`agent id    ${id.agentId}`);
  console.log(`agent uri   ${id.agentUri}`);
  if (id.txHash) console.log(`tx          ${id.txHash}`);
  if (id.explorer) console.log(`explorer    ${id.explorer}`);
  console.log();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

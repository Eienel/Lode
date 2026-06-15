// Approve a pending merchant from the CLI.
// Usage: npx tsx scripts/approve-merchant.ts <pubkey>

import { approveMerchant } from "../lib/merchant-registry";

const pubkey = process.argv[2];
if (!pubkey) {
  console.error("Usage: npx tsx scripts/approve-merchant.ts <pubkey>");
  process.exit(1);
}

approveMerchant(pubkey)
  .then((r) => console.log("approved:", r))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });

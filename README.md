# Lode

An agent-to-agent alpha market on Byreal (Solana CLMM).

A merchant agent mines Byreal concentrated-liquidity pools, packages each finding into a signed Alpha Signal, and sells it to buyer agents who verify, pay, and execute. The marketplace layer between agents is the point, not a single trading bot.

Live: https://uselode.vercel.app

---

## The loop

```
Merchant agent                          Buyer agent
--------------                          -----------
pools list (Byreal)                     browse catalog
pools analyze (top APRs, range bands)   rank by risk-adjusted ROI
top-positions (copy targets)            verify ed25519 seal
synthesize (claude-sonnet-4-6)          pay in SOL or USDC (mainnet)
seal (sha256 hash + ed25519 sign)       receive unlocked signal
price in USDC                           run positions copy --dry-run
list on catalog                         ledger entry settled
```

Every signal is sealed by the merchant's key. Buyers verify the seal before paying. Every purchase lands in an on-disk ledger. That ledger is the evidence of a real agent-to-agent wallet economy.

---

## Modes

**Live mode (default on the site):** real Byreal pool data fetched over HTTP. Connect a Solana wallet (Phantom or Solflare) to pay with real USDC or SOL on mainnet. Execution stays dry-run so no positions open without your explicit confirm in the CLI.

**Mock mode:** realistic fixture data, instant payments, no wallet needed. Everything works the same way, nothing touches mainnet. Toggle with the pill in the header or visit `/?mode=mock`.

First-time visitors are asked which mode they want. The choice can be changed anytime.

---

## What is live on mainnet and testnet

**Solana mainnet**
- Signal payments in USDC or SOL go to the merchant agent pubkey `5EhEKnYin2nhs3CUReoYFmaUySRaYZnNrnCqZmc4TV76`
- USDC mint: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- Real tx signatures land in the economy ledger, marked "solana"

**Mantle Sepolia testnet (chain 5003)**
- IdentityRegistry contract: `0xb430a1cb382aa307f0aeb140bf20c4220f7dd24a`
- Merchant agent registered as ERC-8004 agent #1, URI `did:lode:5EhEKnYin2nhs3CUReoYFmaUySRaYZnNrnCqZmc4TV76#lode-merchant`
- Register tx: https://explorer.sepolia.mantle.xyz/tx/0x481cb61ed8241a066f0ffb377dfe6a2e09a188ddc705f699459709a061972f14
- Economy tx (0.05 MNT): https://explorer.sepolia.mantle.xyz/tx/0x1951aa812f04f18502ea71531928216e1c3d3f441f6a93043a1a1604593491ea

---

## Architecture

```
lib/byreal-api.ts     fetch from api2.byreal.io (same endpoints as byreal-cli)
lib/byreal.ts         normalizes data, mock fixture fallback
lib/merchant.ts       mine, analyze, pick band, synthesize, seal
lib/economy.ts        catalog, payment backends, ledger, reputation
lib/identity.ts       ed25519 agent DID, seal and verify
lib/mantle.ts         ERC-8004 identity registry on Mantle
app/                  Next.js 14 dashboard (server components + client islands)
components/           SignalCard, PayButton, RangeViz, WalletConnect, Onboarding
scripts/buyer.ts      headless A2A loop (terminal)
scripts/merchant.ts   standalone mine and seal
contracts/            IdentityRegistry.sol (deployed on Mantle Sepolia)
```

---

## Run locally

```bash
npm install
npm run dev                   # mock mode, http://localhost:3000
LODE_MOCK=0 npm run dev       # live Byreal data
npm run buyer                 # headless A2A loop in the terminal
LODE_MOCK=0 npm run buyer     # same loop against live data
npm run merchant              # mine and print the signal catalog
```

Add `ANTHROPIC_API_KEY` to `.env` to use claude-sonnet-4-6 for synthesis. Without it a deterministic local writer runs instead and everything still works.

See `.env.example` for all options.

---

## How a judge verifies it

1. **Browse and buy, no wallet.** Open https://uselode.vercel.app and buy any signal. Ed25519 seal verifies, signal unlocks, ledger updates.

2. **Verify Mantle identity, no wallet.**
   ```bash
   cast call 0xb430a1cb382aa307f0aeb140bf20c4220f7dd24a \
     "getAgent(uint256)" 1 --rpc-url https://rpc.sepolia.mantle.xyz
   ```
   Returns agent id 1 and URI `did:lode:5EhEKnYin2nhs3CUReoYFmaUySRaYZnNrnCqZmc4TV76#lode-merchant`.

3. **Run the headless loop with live data.**
   ```bash
   git clone <this repo> && cd Lode && npm install
   LODE_MOCK=0 npm run buyer
   # prints: catalog, pick, seal verify, payment, unsealed signal, dry-run command, ledger
   ```

4. **Run the dry-run against a real position.**
   ```bash
   npm install -g @byreal-io/byreal-cli && byreal-cli setup
   # copy the positions copy command from the buyer output, e.g.:
   byreal-cli positions copy --position <addr> --amount-usd 250 --dry-run
   # returns a live quote against a real on-chain position
   ```

5. **Pay with a real wallet.** On the live site, connect Phantom or Solflare, choose USDC or SOL, buy a signal. The Solana tx signature appears in the ledger.

---

## CLI rules honored

Always `--dry-run` before `--confirm`. Never request, display, or log private keys. Never truncate on-chain addresses or signatures. Reserve SOL buffer for position ops. Secrets are loaded from env and gitignored.

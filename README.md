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

Every signal is sealed by the merchant's key. Buyers verify the seal before paying. Every purchase lands in a ledger. That ledger is the evidence of a real agent-to-agent wallet economy.

---

## Open merchant marketplace

Lode is not a single merchant. Anyone can run one. The gate is deliberately two layers so the catalog does not fill with spam:

1. **Economic gate.** A new merchant picks a tier and pays the fee on Solana mainnet at `/register`. Tiers are Starter (10 USDC, list up to 2 signals) and Pro (25 USDC, list up to 5). The server verifies the payment landed on-chain to the treasury for the chosen tier before the application is accepted, and each fee transaction can only be used once.
2. **Approval gate.** A paid application sits in a pending queue. An admin approves it (via the admin endpoint or `scripts/approve-merchant.ts`) before the merchant's signals appear in the public catalog. A suspended merchant's signals drop out automatically.

Approved merchants seal their own signals with their own ed25519 key and submit them to `/api/submit-signal`. The server re-verifies the seal, confirms the signer is an approved merchant, and enforces the tier signal cap, so nobody can submit signals as someone else or exceed what they paid for. Lode keeps a 20% platform fee per sale (tracked on every ledger entry); the merchant keeps 80%.

---

## Trust model and verification

Lode handles real money on mainnet, so payments are never taken on trust from the client:

- **Buying a signal.** The buyer's wallet signs and sends the transfer client-side. The server then verifies that transaction on-chain (correct recipient, sufficient USDC or SOL, not already used) before unlocking the signal and recording the sale. A replayed or insufficient payment is rejected.
- **Registering a merchant.** Same verification on the tier fee (10 or 25 USDC) before the application is accepted.
- **Private keys** are never requested, displayed, logged, or committed. Wallet signing happens entirely in the browser.
- **Execution** is dry-run first, always. The site refuses any `--confirm` command. Opening a real position happens only in the buyer's own terminal (see below).

Persistence: the registry, ledger, and submitted signals use a durable store. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` for data that persists and stays consistent across serverless instances. Without them the app falls back to JSON files under `LODE_DATA_DIR`, which is fine for local dev and demos but is ephemeral on Vercel.

---

## Modes

**Live mode (default on the site):** real Byreal pool data fetched over HTTP. Connect a Solana wallet (Phantom or Solflare) to pay with real USDC or SOL on mainnet. Execution stays dry-run so no positions open without your explicit confirm in the CLI.

**Mock mode:** realistic fixture data, instant payments, no wallet needed. Everything works the same way, nothing touches mainnet. Toggle with the pill in the header or visit `/?mode=mock`.

First-time visitors are asked which mode they want. The choice can be changed anytime.

---

## What is live on mainnet and testnet

**Solana mainnet**
- Signal payments and merchant registration fees in USDC or SOL go to the house merchant treasury `CHii3jRQguQHeNECGkBLnc3noaA68NC2fVc11yEN8QEv`
- USDC mint: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- Payments are verified on-chain server-side before a signal unlocks; real tx signatures land in the economy ledger, marked "solana"

**Mantle Sepolia testnet (chain 5003)**
- IdentityRegistry contract: `0xb430a1cb382aa307f0aeb140bf20c4220f7dd24a`
- The ERC-8004 identity was registered as agent #1 with URI `did:lode:5EhEKnYin2nhs3CUReoYFmaUySRaYZnNrnCqZmc4TV76#lode-merchant` to demonstrate on-chain agent identity. That registration is immutable; the live Solana payment wallet above is the current house merchant.
- Register tx: https://explorer.sepolia.mantle.xyz/tx/0x481cb61ed8241a066f0ffb377dfe6a2e09a188ddc705f699459709a061972f14
- Economy tx (0.05 MNT): https://explorer.sepolia.mantle.xyz/tx/0x1951aa812f04f18502ea71531928216e1c3d3f441f6a93043a1a1604593491ea

---

## Architecture

```
lib/byreal-api.ts        fetch from api2.byreal.io (same endpoints as byreal-cli)
lib/byreal.ts            normalizes data, mock fixture fallback
lib/merchant.ts          mine, analyze, pick band, synthesize, seal
lib/economy.ts           catalog, payment backends, ledger, reputation
lib/identity.ts          ed25519 agent DID, seal and verify
lib/merchant-registry.ts merchant registration, approval, submitted signals
lib/solana-verify.ts     server-side on-chain payment verification
lib/store.ts             durable key-value store (Redis or file)
lib/mantle.ts            ERC-8004 identity registry on Mantle
app/register/            merchant registration page (tiered fee)
app/api/                 register-merchant, admin/approve-merchant, submit-signal
components/              SignalCard, PayButton, MerchantRegister, RangeViz, Onboarding
scripts/buyer.ts         headless A2A loop (terminal)
scripts/merchant.ts      standalone mine and seal
scripts/approve-merchant.ts  CLI merchant approval
contracts/               IdentityRegistry.sol (deployed on Mantle Sepolia)
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

## Two-step execution flow

Lode follows a strict dry-run-first policy. No position is opened without an explicit confirm step in the buyer's own terminal.

**Step 1: dry-run on site.** After buying a signal, click "run dry-run now." The site calls the byreal-cli `positions copy --dry-run` command on its own server and shows the live quote. No wallet is touched, no position opens.

**Step 2: confirm in your terminal.** The unlocked card shows a `--confirm` version of the same command. Copy it and run it yourself with byreal-cli installed and your wallet configured. This is the only way a position opens. The site never holds private keys.

```
buy signal on site     -->  dry-run on site (live quote, no trade)
                        -->  copy --confirm command
                        -->  run in your terminal (real position opens)
```

---

## How a judge verifies it

1. **Browse and buy, no wallet.** Open https://uselode.vercel.app and buy any signal. Ed25519 seal verifies, signal unlocks, dry-run runs, ledger updates.

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

5. **Open a real position.** Replace `--dry-run` with `--confirm` in the command above. Requires byreal-cli wallet configured and at least 0.03 SOL buffer in the wallet.

6. **Pay with a real wallet.** On the live site, connect Phantom or Solflare, choose USDC or SOL, buy a signal. The Solana tx signature appears in the ledger.

---

## CLI rules honored

Always `--dry-run` before `--confirm`. Never request, display, or log private keys. Never truncate on-chain addresses or signatures. Reserve SOL buffer for position ops (0.03 SOL for open). Secrets are loaded from env and gitignored.

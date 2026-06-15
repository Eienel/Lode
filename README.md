# Lode

An autonomous agent-to-agent alpha market on Byreal (Solana CLMM).

Lode is not a single trading bot. It is a small economy. A merchant agent mines
Byreal concentrated-liquidity pools for the best ranges and top farmers, packages
each finding into a signed, priced Alpha Signal, and sells it wallet-to-wallet to
buyer agents who verify the seal, pay, unlock the full signal, and run the
ready-made execution. The marketplace layer between agents is the point.

Live demo: https://uselode.vercel.app

## Why this fits the Agentic Economy track

The track asks for an agentic wallet economy built on the Byreal Skills CLI, not a
lone agent. Lode has two distinct agent roles with their own keypair identities,
a product (sealed Alpha Signals), a price (USDC), a payment rail (mock or real
Solana), and a settlement record (an on-disk ledger). Value moves between agents.

- Byreal integration depth: the merchant uses `pools list`, `pools analyze`
  (range analysis, risk factors, projections) and `positions top-positions` to
  mine alpha, then emits real `positions copy` / `positions open` dry-run
  commands the buyer executes. It chains the CLI's read and write surfaces, not a
  single endpoint.
- Agent autonomy: the merchant ranks pools, picks the optimal LP band, reasons
  about it with claude-sonnet-4-6, seals it, and prices it without human input.
  The buyer browses, ranks by risk-adjusted ROI, verifies the signature, pays,
  and produces an executable command on its own.
- Verifiability: every signal is hashed and ed25519-signed by the merchant's
  identity. Buyers verify before paying. Every purchase is appended to a ledger
  that anyone can read. Reputation (sales, revenue) is derived from that ledger.

## Architecture

```
byreal-cli  ──►  lib/byreal.ts      typed wrapper, JSON parsing, mock fixtures
                      │
                      ▼
                 lib/merchant.ts    mine ► analyze ► pick band ► synthesize
                      │             (claude-sonnet-4-6) ► seal (ed25519)
                      ▼
                 lib/economy.ts     catalog, payment backends, ledger, reputation
                      │
        ┌─────────────┴──────────────┐
        ▼                            ▼
  scripts/buyer.ts            app/ (Next.js dashboard)
  headless A2A loop           marketplace, buy flow, live ledger
```

- `lib/byreal.ts` is the data layer. By default (`LODE_MOCK` unset) it serves
  real captured fixtures so the app runs with zero install and zero funds. With
  `LODE_MOCK=0` it fetches live data over HTTP from the same api2.byreal.io
  endpoints the byreal-cli uses (`lib/byreal-api.ts`), which is how the hosted
  site stays live without spawning a CLI in a serverless function.
- `lib/identity.ts` gives each agent an ed25519 keypair; the base58 public key is
  its DID. Signals are canonicalized, hashed (sha256), and signed.
- `lib/merchant.ts` is the mining and synthesis pipeline.
- `lib/economy.ts` is the marketplace: catalog, a `Payment` interface with mock
  and Solana backends, the ledger, and ledger-derived reputation.
- `lib/mantle.ts` registers the agent identity as an ERC-8004 agent on Mantle
  (stretch, flagged with `LODE_MANTLE=1`).
- `scripts/buyer.ts` runs the full agent-to-agent loop in the terminal.

## Run it

Mock mode (no install, no wallet, no funds):

```bash
npm install
npm run dev            # dashboard at http://localhost:3000
npm run buyer          # headless A2A loop in the terminal
npm run merchant       # mine and seal signals, print the catalog
```

Live Byreal data (over HTTP, no CLI needed):

```bash
LODE_MOCK=0 npm run dev      # pulls live pools, overview, and top farmers
LODE_MOCK=0 npm run buyer    # emits a real, executable positions copy --dry-run
```

To actually run the emitted dry-run against the chain, install the CLI and set up
your own wallet:

```bash
npm install -g @byreal-io/byreal-cli
byreal-cli setup
byreal-cli positions copy --position <addr-from-signal> --amount-usd 250 --dry-run
```

Add `ANTHROPIC_API_KEY` to `.env` for the merchant's claude-sonnet-4-6 synthesis.
Without it, a deterministic local synthesizer keeps the demo fully working.

See `.env.example` for all options, `SUBMISSION.md` for the writeup, and `DEMO.md`
for the 90 second video script.

## Hard rules honored

From the Byreal CLI: always `--dry-run` before `--confirm`; never request,
display, or log private keys; never truncate on-chain addresses or signatures;
reserve a SOL buffer for position ops. Secrets are loaded from env and gitignored.

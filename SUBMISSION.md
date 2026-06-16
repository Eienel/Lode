# Lode: DoraHacks BUIDL writeup

Track: Agentic Economy (exclusively supported by Byreal). Hackathon: Turing Test
2026 (Mantle / Bybit / Byreal).

Live demo: https://uselode.vercel.app
Repo: this repository.

## Problem

Agent tooling today is almost all single-agent: one bot reads a market and trades
its own wallet. That is automation, not an economy. The hard, interesting part of
an "agentic economy" is the layer between agents: how one agent produces something
valuable, proves it authored it, prices it, and sells it to another agent that can
independently verify and act on it. Nobody has built that on Byreal.

## Solution

Lode is a working two-sided market between autonomous agents on Byreal.

1. A merchant agent mines Byreal CLMM pools. It lists pools, runs `pools analyze`
   on the top candidates (TVL, volume, fee APR, per-range fee estimates,
   in-range likelihood, risk factors, projections), and pulls `top-positions` to
   find farmers worth copying.
2. It picks the LP band that best balances fee yield against staying in range,
   asks claude-sonnet-4-6 to synthesize a plain-english rationale and a free
   teaser, scores risk, and prices the signal in USDC.
3. It seals the signal: the payload is canonicalized, hashed with sha256, and
   signed with the merchant's ed25519 key. The merchant's base58 public key is
   its on-chain-style DID.
4. A buyer agent browses the catalog, ranks by risk-adjusted ROI, verifies the
   merchant's signature against the payload hash, pays, and receives the full
   signal plus a ready-to-run `byreal-cli positions copy/open --dry-run` command.
5. The purchase is appended to a ledger. Reputation (sales, revenue) is computed
   from the ledger. This is the evidence of a real agent-to-agent wallet economy.

## Why it fits "Agentic Wallets & Economy"

- Two agent roles, each with its own cryptographic identity and wallet.
- A product, a price, a payment rail, and a settlement record between them.
- Value (USDC) moves agent to agent; the marketplace is the deliverable, not a
  single trading strategy.

## What is built on the Byreal Skills CLI

The merchant pipeline chains multiple Byreal capabilities, not one endpoint:

- `dex.pool.list`, candidate discovery, sorted by APR.
- `dex.pool.analyze`, the core of each signal: range analysis, fee APR per band,
  in-range likelihood, volatility, risk factors, investment projection.
- `dex.position.topPositions`, copy targets (top farmers in a pool).
- `dex.position.copy` / `dex.position.open`, the executable output, emitted as
  dry-run commands the buyer runs.

All write operations are emitted as `--dry-run` first, per the CLI's hard rules.
The wrapper (`lib/byreal.ts`) parses `-o json` output and degrades to realistic
captured fixtures in mock mode so judges can run everything instantly.

## Agent autonomy

The merchant chooses pools, selects the optimal band, reasons with
claude-sonnet-4-6, scores and prices, and seals, no human in the loop. The buyer
discovers, ranks, verifies the seal, settles payment, and produces an executable
command on its own. `npm run buyer` shows the whole loop end to end in the
terminal.

## Verifiability and demo quality

- Every signal carries its sha256 payload hash and an ed25519 signature over it.
  The buyer recomputes the hash and verifies the signature before paying; the UI
  shows "seal verified, signature valid".
- Every purchase is a ledger record with buyer DID, merchant DID, signal id,
  amount, tx reference, backend, and timestamp.
- Two runnable demos: the dashboard (browse, buy, watch the ledger update live)
  and the headless `npm run buyer` A2A loop.

## Mantle ecosystem contribution (live on testnet)

Identity is portable across chains. The economy runs on Solana/Byreal, while the
agent's identity is registered as an ERC-8004 agent on Mantle. This anchors agent
reputation to Mantle's trustless-agent standard while keeping execution where the
liquidity is.

Live on Mantle Sepolia (chain 5003):

- IdentityRegistry contract: `0xb430a1cb382aa307f0aeb140bf20c4220f7dd24a`
- Merchant agent id: `1`, URI `did:lode:5EhEKnYin2nhs3CUReoYFmaUySRaYZnNrnCqZmc4TV76#lode-merchant`
- Deploy tx: https://explorer.sepolia.mantle.xyz/tx/0xd63ad6bd827a6d68e167600d9916829fdd0f05bcd7507d2a58a0791192a4c2a0
- Register tx: https://explorer.sepolia.mantle.xyz/tx/0x481cb61ed8241a066f0ffb377dfe6a2e09a188ddc705f699459709a061972f14

The contract is `contracts/IdentityRegistry.sol`; deploy and register with
`npm run register-mantle` (read path) or `tsx scripts/deploy-mantle.ts` (deploy +
register). The dashboard reads the on-chain agent id and links to the explorer.

## What is real vs mocked

- Real: Byreal data and analysis (captured from the live CLI; live with
  `LODE_MOCK=0`), ed25519 sealing and verification, the ledger and reputation,
  the synthesis (claude-sonnet-4-6 with `ANTHROPIC_API_KEY`).
- Mocked by default for a frictionless demo: payment settlement (instant mock
  backend; a real Solana transfer backend is included and env-gated) and the
  Mantle registration when no EVM key is supplied.

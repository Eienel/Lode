# Lode — 90 second demo script
# Lode — demo guide

Goal: show one full agent-to-agent loop. Mine, seal, pay, unlock, execute, settle.
Live site: https://uselode.vercel.app (serves live Byreal data, badge reads
"live byreal"). Goal of the demo: show one full agent-to-agent loop — mine, seal,
pay, unlock, execute, settle — and the on-chain Mantle identity behind it.

Setup before recording:
```bash
npm install
npm run dev      # dashboard on http://localhost:3000
```
Use the live site if you prefer: https://uselode.vercel.app
You can record the whole thing from the live site plus one terminal. No wallet or
funds are needed to record.

---

## 90 second video script

0:00 — 0:12  The pitch
"This is Lode, an agent-to-agent alpha market on Byreal. One agent mines
liquidity-pool alpha and sells it to other agents. This is an economy, not a bot."
Show the dashboard: market stats, the grid of Alpha Signals, the agents panel, and
the empty economy ledger.
Open https://uselode.vercel.app. "This is Lode, an agent-to-agent alpha market on
Byreal. One agent mines liquidity-pool alpha and sells it to other agents. This is
an economy, not a bot." Show the market stats, the grid of Alpha Signals, the
agents panel, and the economy ledger.

0:12 — 0:30  The merchant
"A merchant agent mined these from live Byreal pools. For each one it ran pools
analyze, picked the LP band with the best fee yield that stays in range, and asked
claude-sonnet-4-6 to write the rationale. Every signal is sealed with the
merchant's ed25519 key."
Point at a card: pair, est fee APR, risk, confidence, price in USDC, and the
locked teaser.
"A merchant agent mined these from live Byreal pools. For each one it ran pool
analysis, picked the LP band with the best fee yield that still stays in range,
and asked claude-sonnet-4-6 to write the rationale. Every signal is sealed with
the merchant's ed25519 key." Point at one card: pair, est fee APR, risk,
confidence, price in USDC, and the locked teaser.

0:30 — 0:50  The buy
"As a buyer agent I pick the best risk-adjusted signal and pay." Click "buy and
unlock". The payment step settles, then the card opens: "seal verified, signature
valid", the recommended band drawn against the current price, the rationale, the
copy target, and the ready-to-run command.
copy target, and a ready-to-run command.

0:50 — 1:05  The execution
"The signal hands me a Byreal command, dry-run first, always." Read the
`byreal-cli positions copy --dry-run` line. Optionally cut to a terminal running
it against live Byreal.
"The signal hands the buyer a Byreal command, dry-run first, always." Read the
`byreal-cli positions copy ... --dry-run` line aloud.

1:05 — 1:20  The economy
"The purchase settled to the ledger. Merchant revenue and sales just went up. That
ledger is the proof of an agent-to-agent wallet economy." Show the economy ledger
row and the merchant reputation updating.
1:05 — 1:20  The economy and Mantle
Show the new row in the economy ledger and the merchant revenue and sales ticking
up. "That ledger is the proof of an agent-to-agent wallet economy." Point at the
"mantle erc-8004, registered, agent #1" badge. "The agent's identity is registered
on Mantle, on testnet, right now." Optionally click it to open the explorer.

1:20 — 1:30  The whole loop, headless
Cut to a terminal: `npm run buyer`. It browses, ranks, verifies the seal, pays,
unlocks, prints the execution command, and shows the ledger. "Same loop, fully
autonomous, no human in it." End on the Lode dashboard.
Cut to a terminal: `LODE_MOCK=0 npm run buyer`. It browses live signals, ranks,
verifies the seal, pays, unlocks, prints the execution command, and shows the
ledger. "Same loop, fully autonomous, no human in it." End on the dashboard.

---

Backup talking points if asked:
- Mock mode runs with no install or funds; `LODE_MOCK=0` uses live Byreal.
- Payment has a mock backend and a real Solana backend behind an env flag.
- Agents can register an ERC-8004 identity on Mantle (`LODE_MANTLE=1`).
## Running the headless loop for the recording

From the repo:

```bash
npm install
LODE_MOCK=0 npm run buyer     # live Byreal data, prints the full A2A loop
```

What it prints, in order: the buyer's DID, the live alpha catalog, the
risk-adjusted pick, the seal verification, the mock payment tx, the unsealed
signal (pool, range, est fee APR, copy farmer, rationale), the ready-to-run
`positions copy --dry-run` command, and the updated ledger.

Other useful commands:

```bash
npm run dev                   # dashboard locally (fixtures)
LODE_MOCK=0 npm run dev       # dashboard locally on live data
npm run merchant              # just mine and seal the catalog, print it
```

---

## How a judge verifies everything passes

1. Browse and buy, no wallet. On https://uselode.vercel.app buy any signal. The
   ed25519 seal verifies, the signal unlocks, the ledger updates.

2. Verify the Mantle identity, no wallet. Open the register tx below, or read the
   contract:
   ```bash
   cast call 0xb430a1cb382aa307f0aeb140bf20c4220f7dd24a \
     "getAgent(uint256)" 1 --rpc-url https://rpc.sepolia.mantle.xyz
   ```
   Returns agent id 1, the owner, and agentURI
   `did:lode:5EhEKnYin2nhs3CUReoYFmaUySRaYZnNrnCqZmc4TV76#lode-merchant`, which
   ties the Mantle agent to the merchant's Solana DID on the dashboard.

3. Verify the live Byreal alpha with your own wallet. This is the key test:
   ```bash
   git clone <repo> && cd Lode && npm install
   LODE_MOCK=0 npm run buyer        # emits a real on-chain position address
   npm install -g @byreal-io/byreal-cli && byreal-cli setup   # your own wallet
   byreal-cli positions copy --position <addr-from-output> --amount-usd 250 --dry-run
   ```
   The dry-run returns a live quote and preview against the real position the
   signal points at. It stays dry-run, so no funds move.

4. Cross-check the data. `byreal-cli pools analyze <pool-addr>` matches the TVL,
   fee APR, and range bands Lode mined.

On-chain artifacts (Mantle Sepolia, chain 5003):

- Registry contract: `0xb430a1cb382aa307f0aeb140bf20c4220f7dd24a`
- Deploy tx: https://explorer.sepolia.mantle.xyz/tx/0xd63ad6bd827a6d68e167600d9916829fdd0f05bcd7507d2a58a0791192a4c2a0
- Register tx: https://explorer.sepolia.mantle.xyz/tx/0x481cb61ed8241a066f0ffb377dfe6a2e09a188ddc705f699459709a061972f14

---

## What is real vs mocked (be upfront if asked)

- Real: live Byreal pools, overview, and top farmers over HTTP; the ed25519
  sealing and verification; the ledger and reputation; the Mantle testnet
  registration; the emitted dry-run commands point at real on-chain positions.
- Mocked for a frictionless click-through: payment settlement uses an instant
  mock backend (a real Solana transfer backend is in the repo behind
  `LODE_PAYMENT_BACKEND=solana`). Synthesis uses a deterministic local writer when
  `ANTHROPIC_API_KEY` is not set; with the key it uses claude-sonnet-4-6.

# Lode: demo guide

Live site: https://uselode.vercel.app (live Byreal data, wallet connect, real SOL/USDC payment).
Goal: show one full agent-to-agent loop, mine, seal, pay, unlock, execute, settle, and the on-chain Mantle identity.

You can record the whole thing from the live site plus one terminal. No wallet or funds needed for the mock flow.

---

## 90 second video script

0:00, 0:12  The pitch
Open https://uselode.vercel.app. "This is Lode, an agent-to-agent alpha market on Byreal. One agent mines liquidity-pool alpha and sells it to other agents. This is an economy, not a bot." Show the market stats, the signal grid, the agents panel, and the economy ledger.

0:12, 0:30  The merchant
"A merchant agent mined these from live Byreal pools. For each one it ran pool analysis, picked the LP band with the best fee yield that stays in range, and asked claude-sonnet-4-6 to write the rationale. Every signal is sealed with the merchant's ed25519 key." Point at one card: pair, est fee APR, risk, confidence, price in USDC, locked teaser.

0:30, 0:50  The buy
"As a buyer agent I pick the best risk-adjusted signal and pay." Click "buy and unlock". Payment settles, card opens: "seal verified, signature valid", the recommended band drawn against current price, the rationale, the copy target, and a ready-to-run command.

0:50, 1:05  The execution
"The signal hands the buyer a Byreal command, dry-run first, always." Click "run dry-run now", the CLI output appears inline. Or read the `byreal-cli positions copy ... --dry-run` line aloud.

1:05, 1:20  The economy and Mantle
Show the new ledger row and merchant revenue ticking up. "That ledger is the proof of an agent-to-agent wallet economy." Point at "mantle erc-8004, registered, agent #1". "The agent's identity is registered on Mantle testnet, right now." Click to open the explorer.

1:20, 1:30  The whole loop, headless
Terminal: `LODE_MOCK=0 npm run buyer`. Browses live signals, ranks, verifies the seal, pays, unlocks, prints the dry-run command, shows the ledger. "Same loop, fully autonomous." End on the dashboard.

---

## Running the headless loop

```bash
npm install
LODE_MOCK=0 npm run buyer     # live Byreal data, full A2A loop in the terminal
```

Other commands:

```bash
npm run dev                   # dashboard locally (mock fixtures)
LODE_MOCK=0 npm run dev       # dashboard locally on live data
npm run merchant              # mine and seal the catalog, print it
```

---

## Wallet payment (with real SOL or USDC)

1. Open https://uselode.vercel.app
2. Click "connect wallet" (top right), Phantom or Solflare
3. A payment toggle appears on each card: "pay in USDC" | "pay in SOL"
4. Click "pay and unlock", your wallet prompts to approve a real mainnet transfer to the merchant (`5EhEKnYin2nhs3CUReoYFmaUySRaYZnNrnCqZmc4TV76`)
5. On confirmation the signal unlocks and the real Solana tx signature lands in the ledger (shown in amber as "solana")
6. Click "run dry-run now" to execute the byreal-cli command inline, the CLI output appears in the card

USDC mint: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` (mainnet)

---

## How a judge verifies everything passes

1. Browse and buy, no wallet. On https://uselode.vercel.app buy any signal. Ed25519 seal verifies, signal unlocks, ledger updates.

2. Verify Mantle identity, no wallet:
   ```bash
   cast call 0xb430a1cb382aa307f0aeb140bf20c4220f7dd24a \
     "getAgent(uint256)" 1 --rpc-url https://rpc.sepolia.mantle.xyz
   # returns id=1, agentURI=did:lode:5EhEKnYin2nhs3CUReoYFmaUySRaYZnNrnCqZmc4TV76#lode-merchant
   ```

3. Verify live Byreal alpha with your own wallet:
   ```bash
   git clone <repo> && cd Lode && npm install
   LODE_MOCK=0 npm run buyer           # emits a real on-chain position address
   npm install -g @byreal-io/byreal-cli && byreal-cli setup
   byreal-cli positions copy --position <addr-from-output> --amount-usd 250 --dry-run
   ```
   Returns a live quote against a real position. Stays dry-run, no funds move.

4. Cross-check: `byreal-cli pools analyze <pool-addr>` matches what Lode mined.

On-chain artifacts (Mantle Sepolia, chain 5003):

- Registry: `0xb430a1cb382aa307f0aeb140bf20c4220f7dd24a`
- Deploy tx: https://explorer.sepolia.mantle.xyz/tx/0xd63ad6bd827a6d68e167600d9916829fdd0f05bcd7507d2a58a0791192a4c2a0
- Register tx: https://explorer.sepolia.mantle.xyz/tx/0x481cb61ed8241a066f0ffb377dfe6a2e09a188ddc705f699459709a061972f14
- Economy tx: https://explorer.sepolia.mantle.xyz/tx/0x1951aa812f04f18502ea71531928216e1c3d3f441f6a93043a1a1604593491ea

---

## What is real vs mocked

- Real: live Byreal pools and data over HTTP, ed25519 sealing and verification, ledger and reputation, Mantle testnet registration + economy tx, emitted dry-run commands point at real on-chain positions, real SOL/USDC payment when wallet is connected.
- Mock by default for frictionless click-through: instant mock payment backend (no wallet needed), deterministic local synthesis when `ANTHROPIC_API_KEY` is not set.

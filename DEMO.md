# Lode — 90 second demo script

Goal: show one full agent-to-agent loop. Mine, seal, pay, unlock, execute, settle.

Setup before recording:
```bash
npm install
npm run dev      # dashboard on http://localhost:3000
```
Use the live site if you prefer: https://uselode.vercel.app

---

0:00 — 0:12  The pitch
"This is Lode, an agent-to-agent alpha market on Byreal. One agent mines
liquidity-pool alpha and sells it to other agents. This is an economy, not a bot."
Show the dashboard: market stats, the grid of Alpha Signals, the agents panel, and
the empty economy ledger.

0:12 — 0:30  The merchant
"A merchant agent mined these from live Byreal pools. For each one it ran pools
analyze, picked the LP band with the best fee yield that stays in range, and asked
claude-sonnet-4-6 to write the rationale. Every signal is sealed with the
merchant's ed25519 key."
Point at a card: pair, est fee APR, risk, confidence, price in USDC, and the
locked teaser.

0:30 — 0:50  The buy
"As a buyer agent I pick the best risk-adjusted signal and pay." Click "buy and
unlock". The payment step settles, then the card opens: "seal verified, signature
valid", the recommended band drawn against the current price, the rationale, the
copy target, and the ready-to-run command.

0:50 — 1:05  The execution
"The signal hands me a Byreal command, dry-run first, always." Read the
`byreal-cli positions copy --dry-run` line. Optionally cut to a terminal running
it against live Byreal.

1:05 — 1:20  The economy
"The purchase settled to the ledger. Merchant revenue and sales just went up. That
ledger is the proof of an agent-to-agent wallet economy." Show the economy ledger
row and the merchant reputation updating.

1:20 — 1:30  The whole loop, headless
Cut to a terminal: `npm run buyer`. It browses, ranks, verifies the seal, pays,
unlocks, prints the execution command, and shows the ledger. "Same loop, fully
autonomous, no human in it." End on the Lode dashboard.

---

Backup talking points if asked:
- Mock mode runs with no install or funds; `LODE_MOCK=0` uses live Byreal.
- Payment has a mock backend and a real Solana backend behind an env flag.
- Agents can register an ERC-8004 identity on Mantle (`LODE_MANTLE=1`).

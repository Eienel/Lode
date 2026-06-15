// Display helpers. Full on-chain strings are never truncated in data, only
// visually shortened in dedicated address chips where the full value is on hover
// and copy.

export const usd = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}m`
    : n >= 1_000
      ? `$${(n / 1_000).toFixed(1)}k`
      : `$${n.toFixed(2)}`;

export const pct = (n: number) => `${n.toFixed(n >= 100 ? 0 : 1)}%`;

export const riskLabel = (r: number) => (r < 30 ? "calm" : r < 55 ? "moderate" : r < 75 ? "warm" : "hot");

export const riskColor = (r: number) => (r < 30 ? "text-good" : r < 55 ? "text-warn" : "text-bad");

// short visual form for an address chip; full string lives in title/copy
export const shortAddr = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

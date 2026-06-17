// Shared types for Lode. These mirror the byreal-cli JSON shapes we consume,
// plus the marketplace types the economy layer adds on top.

export interface Token {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logo_uri?: string;
  price_usd: number;
}

export interface Pool {
  id: string;
  pair: string;
  token_a: Token;
  token_b: Token;
  tvl_usd: number;
  volume_24h_usd: number;
  volume_7d_usd: number;
  fee_rate_bps: number;
  fee_24h_usd: number;
  apr: number;
  reward_apr: number;
  total_apr: number;
  current_price: number;
  price_change_1h: number;
  price_change_24h: number;
  price_change_7d: number;
}

export interface RangeBand {
  rangePercent: number;
  priceLower: string;
  priceUpper: string;
  estimatedFeeApr: string;
  estimatedTotalApr: string;
  inRangeLikelihood: "low" | "medium" | "high";
  rebalanceFrequency: "low" | "medium" | "high";
}

export interface PoolAnalysis {
  pool: {
    address: string;
    pair: string;
    category: string;
    currentPrice: string;
    feeRate: string;
    tickSpacing: number;
  };
  metrics: {
    tvl: string;
    volume24h: string;
    volume7d: string;
    fee24h: string;
    fee7d: string;
    feeApr24h: string;
    totalApr: string;
    volumeToTvl: string;
  };
  volatility: {
    dayPriceRange: { low: string; high: string };
    dayPriceRangePercent: string;
  };
  rangeAnalysis: RangeBand[];
  riskFactors: {
    tvlRisk: string;
    volatilityRisk: string;
    summary: string[];
  };
  investmentProjection: {
    amountUsd: number;
    rangePercent: number;
    priceLower: string;
    priceUpper: string;
    dailyFeeEstimate: string;
    weeklyFeeEstimate: string;
    monthlyFeeEstimate: string;
    note: string;
  };
}

export interface TopPosition {
  poolAddress: string;
  positionAddress: string;
  nftMintAddress: string;
  walletAddress: string;
  liquidityUsd: string;
  earnedUsd: string;
  pnlUsd: string;
  copies: number;
  pair: string;
  inRange: boolean;
  priceLower: string;
  priceUpper: string;
}

export interface Overview {
  tvl: number;
  tvl_change_24h: number;
  volume_24h_usd: number;
  volume_change_24h: number;
  fee_24h_usd: number;
  pools_count: number;
}

// The product the merchant agent mines, synthesizes, and sells.
export interface AlphaSignal {
  id: string;
  poolAddr: string;
  pair: string;
  tokenALogo?: string;
  tokenBLogo?: string;
  currentPrice: number;
  recommendedRange: { lower: number; upper: number; rangePercent: number };
  estFeeApr: number;
  riskScore: number; // 0 (calm) to 100 (hot)
  copyTarget: {
    walletAddress: string;
    positionAddress: string;
    liquidityUsd: number;
    copies: number;
  } | null;
  rationale: string; // plain english, generated
  teaser: string; // free public preview
  confidence: number; // 0..1
  priceUsdc: number; // unlock price
  inRangeLikelihood: string;
  // execution: the ready-to-run dry-run command released on purchase
  execCommand: string;
  // sealing: proof the merchant authored this exact payload
  merchantAgent: string; // base58 pubkey, the agent DID
  payloadHash: string; // sha256 hex of the canonical payload
  signature: string; // ed25519 signature hex over the hash
  createdAt: string;
}

// A signal as shown publicly before purchase: full body stripped to the teaser.
export interface ListedSignal extends Omit<AlphaSignal, "rationale" | "recommendedRange" | "copyTarget" | "execCommand"> {
  locked: true;
  recommendedRange: null;
  copyTarget: null;
}

export interface LedgerEntry {
  buyerAgent: string;
  merchantAgent: string;
  signalId: string;
  pair: string;
  amount: number; // USDC
  txRef: string;
  backend: "mock" | "solana" | "base"; // settlement rail; solana and base are both live on-chain
  ts: string;
  platformFee?: number; // 5% of amount, tracked for display, on-chain split is v2
}

// A registered merchant. Anyone can apply by paying the registration fee; an
// admin approves before their signals appear in the public catalog.
export interface MerchantRecord {
  pubkey: string; // base58 agent DID
  label: string;
  bio: string;
  registrationTx: string; // Solana tx of the registration fee payment
  status: "pending" | "approved" | "suspended";
  registeredAt: string;
  approvedAt?: string;
  feeSharePct: number; // share the merchant keeps, e.g. 95 (platform takes 5)
  tier: number; // USD paid at registration (10 or 25)
  signalCap: number; // max signals this merchant may list (2 or 5)
}

// Registration tiers: pay more to list more signals on the dashboard.
export const MERCHANT_TIERS: { usd: number; signals: number; label: string }[] = [
  { usd: 5, signals: 2, label: "Starter" },
  { usd: 10, signals: 5, label: "Pro" },
];

export function signalCapForTier(usd: number): number {
  const tier = MERCHANT_TIERS.find((t) => t.usd === usd);
  return tier ? tier.signals : 0;
}

// A pre-signed signal submitted by an approved external merchant.
export interface ExternalSignal extends AlphaSignal {
  submittedAt: string;
}

export interface AgentReputation {
  agent: string; // pubkey DID
  label: string;
  role: "merchant" | "buyer";
  sales: number;
  revenue: number;
  avgConfidence?: number;
}

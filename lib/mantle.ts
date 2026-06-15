// Mantle ecosystem contribution: register an agent's identity as an ERC-8004
// agent on Mantle. The economy itself runs on Solana/Byreal; this anchors agent
// identity and reputation to Mantle's trustless-agent standard so the two chains
// compose. Real on-chain registration is enabled with LODE_MANTLE=1 plus an RPC,
// an EVM key, and a deployed ERC-8004 IdentityRegistry address. Otherwise it
// returns a deterministic simulated identity so the UI and docs still hold.

import { createHash } from "node:crypto";

export interface MantleIdentity {
  chain: "mantle";
  agentId: string; // ERC-8004 agent id (token id) or simulated id
  agentUri: string; // the identity document the registry points at
  registry: string | null;
  txHash: string | null;
  status: "registered" | "simulated";
  explorer: string | null;
}

// Minimal ERC-8004 IdentityRegistry surface. The standard mints an agent token
// and returns its id; we keep the ABI tolerant via a single register entrypoint.
const REGISTRY_ABI = [
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentURI", type: "string" }],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
] as const;

const MANTLE_TESTNET = {
  id: 5003,
  rpc: "https://rpc.sepolia.mantle.xyz",
  explorer: "https://explorer.sepolia.mantle.xyz",
};

function simulatedId(agentPubkey: string): string {
  const h = createHash("sha256").update(`mantle:erc8004:${agentPubkey}`).digest("hex");
  // present as a uint256-style id, deterministic per agent
  return BigInt("0x" + h.slice(0, 16)).toString();
}

export async function registerOnMantle(agentPubkey: string, label: string): Promise<MantleIdentity> {
  const agentUri = `did:lode:${agentPubkey}#${label}`;
  const rpc = process.env.MANTLE_RPC_URL || MANTLE_TESTNET.rpc;
  const explorer = process.env.MANTLE_EXPLORER || MANTLE_TESTNET.explorer;

  // Fast path: the registry is already deployed and the agent already registered
  // on Mantle (done once via scripts/deploy-mantle.ts). Surface the real on-chain
  // id and tx without a write on every page render.
  const registryAddr = process.env.MANTLE_REGISTRY;
  const deployedId = process.env.LODE_MANTLE_AGENT_ID;
  if (registryAddr && deployedId) {
    const tx = process.env.LODE_MANTLE_TX;
    return {
      chain: "mantle",
      agentId: deployedId,
      agentUri,
      registry: registryAddr,
      txHash: tx ?? null,
      status: "registered",
      explorer: tx ? `${explorer}/tx/${tx}` : `${explorer}/address/${registryAddr}`,
    };
  }

  const enabled = process.env.LODE_MANTLE === "1";
  const pk = process.env.MANTLE_PRIVATE_KEY;
  const registry = registryAddr;

  if (!enabled || !pk || !registry) {
    return {
      chain: "mantle",
      agentId: simulatedId(agentPubkey),
      agentUri,
      registry: registry ?? null,
      txHash: null,
      status: "simulated",
      explorer: registry ? `${MANTLE_TESTNET.explorer}/address/${registry}` : null,
    };
  }

  // Real registration. Imported lazily so the demo path never loads viem.
  const { createWalletClient, createPublicClient, http } = await import("viem");
  const { privateKeyToAccount } = await import("viem/accounts");

  const chain = {
    id: Number(process.env.MANTLE_CHAIN_ID || MANTLE_TESTNET.id),
    name: "Mantle",
    nativeCurrency: { name: "Mantle", symbol: "MNT", decimals: 18 },
    rpcUrls: { default: { http: [rpc] } },
  } as const;

  const account = privateKeyToAccount(pk as `0x${string}`);
  const wallet = createWalletClient({ account, chain, transport: http(rpc) });
  const pub = createPublicClient({ chain, transport: http(rpc) });

  const txHash = await wallet.writeContract({
    address: registry as `0x${string}`,
    abi: REGISTRY_ABI,
    functionName: "register",
    args: [agentUri],
  });
  await pub.waitForTransactionReceipt({ hash: txHash });

  return {
    chain: "mantle",
    agentId: simulatedId(agentPubkey), // resolved from logs in a full build
    agentUri,
    registry,
    txHash,
    status: "registered",
    explorer: `${process.env.MANTLE_EXPLORER || MANTLE_TESTNET.explorer}/tx/${txHash}`,
  };
}

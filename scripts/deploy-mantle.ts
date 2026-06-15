// Compile, deploy, and exercise the Lode ERC-8004 IdentityRegistry on Mantle.
// Reads the deployer key from MANTLE_PRIVATE_KEY (or /tmp/mantle-key.txt for the
// local demo). Deploys the registry, registers the Lode merchant agent, and
// prints the on-chain artifacts. Never commit the key.

import fs from "node:fs";
import path from "node:path";
import solc from "solc";
import { createWalletClient, createPublicClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { loadMerchant } from "../lib/merchant";

const RPC = process.env.MANTLE_RPC_URL || "https://rpc.sepolia.mantle.xyz";
const EXPLORER = process.env.MANTLE_EXPLORER || "https://explorer.sepolia.mantle.xyz";
const CHAIN_ID = Number(process.env.MANTLE_CHAIN_ID || 5003);

const mantle = defineChain({
  id: CHAIN_ID,
  name: "Mantle Sepolia",
  nativeCurrency: { name: "Mantle", symbol: "MNT", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});

function compile() {
  const src = fs.readFileSync(path.join(process.cwd(), "contracts/IdentityRegistry.sol"), "utf8");
  const input = {
    language: "Solidity",
    sources: { "IdentityRegistry.sol": { content: src } },
    settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } },
  };
  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  if (out.errors?.some((e: { severity: string }) => e.severity === "error")) {
    throw new Error(JSON.stringify(out.errors, null, 2));
  }
  const c = out.contracts["IdentityRegistry.sol"].IdentityRegistry;
  return { abi: c.abi, bytecode: ("0x" + c.evm.bytecode.object) as `0x${string}` };
}

function loadKey(): `0x${string}` {
  if (process.env.MANTLE_PRIVATE_KEY) return process.env.MANTLE_PRIVATE_KEY as `0x${string}`;
  const p = "/tmp/mantle-key.txt";
  if (fs.existsSync(p)) return fs.readFileSync(p, "utf8").trim() as `0x${string}`;
  throw new Error("Set MANTLE_PRIVATE_KEY (a funded Mantle Sepolia testnet key).");
}

async function main() {
  const { abi, bytecode } = compile();
  const account = privateKeyToAccount(loadKey());
  const wallet = createWalletClient({ account, chain: mantle, transport: http(RPC) });
  const pub = createPublicClient({ chain: mantle, transport: http(RPC) });

  const bal = await pub.getBalance({ address: account.address });
  console.log(`\ndeployer   ${account.address}`);
  console.log(`balance    ${Number(bal) / 1e18} MNT`);
  if (bal === 0n) throw new Error(`Fund ${account.address} with Mantle Sepolia MNT first.`);

  console.log(`\ndeploying IdentityRegistry to Mantle Sepolia...`);
  const deployHash = await wallet.deployContract({ abi, bytecode });
  const receipt = await pub.waitForTransactionReceipt({ hash: deployHash });
  const registry = receipt.contractAddress!;
  console.log(`registry   ${registry}`);
  console.log(`deploy tx  ${EXPLORER}/tx/${deployHash}`);

  const merchant = loadMerchant();
  const agentURI = `did:lode:${merchant.pubkey}#lode-merchant`;
  console.log(`\nregistering merchant agent...`);
  const regHash = await wallet.writeContract({ address: registry, abi, functionName: "register", args: [agentURI] });
  await pub.waitForTransactionReceipt({ hash: regHash });
  const total = (await pub.readContract({ address: registry, abi, functionName: "totalAgents" })) as bigint;
  const agent = (await pub.readContract({ address: registry, abi, functionName: "getAgent", args: [total] })) as {
    id: bigint;
    agentURI: string;
  };

  console.log(`register tx ${EXPLORER}/tx/${regHash}`);
  console.log(`agent id   ${agent.id}`);
  console.log(`agent uri  ${agent.agentURI}`);

  console.log(`\nSet these on the deployment:`);
  console.log(`  MANTLE_REGISTRY=${registry}`);
  console.log(`  LODE_MANTLE_AGENT_ID=${(agent as { id: bigint }).id}`);
  console.log(`  LODE_MANTLE_TX=${regHash}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

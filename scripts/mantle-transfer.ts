// Send a real MNT transfer on Mantle Sepolia to demonstrate live chain activity.
import { createWalletClient, createPublicClient, http, defineChain, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import fs from "node:fs";

const pk = (process.env.MANTLE_PRIVATE_KEY || fs.readFileSync("/tmp/mantle-key.txt", "utf8").trim()) as `0x${string}`;

const mantle = defineChain({
  id: 5003,
  name: "Mantle Sepolia",
  nativeCurrency: { name: "MNT", symbol: "MNT", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.sepolia.mantle.xyz"] } },
});

async function main() {
  const account = privateKeyToAccount(pk);
  const wallet = createWalletClient({ account, chain: mantle, transport: http() });
  const pub = createPublicClient({ chain: mantle, transport: http() });

  const bal = await pub.getBalance({ address: account.address });
  console.log(`deployer   ${account.address}`);
  console.log(`balance    ${Number(bal) / 1e18} MNT`);

  // Send 0.05 MNT to a burn address — real on-chain Mantle economy tx showing
  // the agent is economically active on Mantle, not just registered.
  const to = "0x000000000000000000000000000000000000dEaD" as `0x${string}`;
  const hash = await wallet.sendTransaction({ to, value: parseEther("0.05") });
  console.log(`\nsending 0.05 MNT to registry ${to}...`);
  await pub.waitForTransactionReceipt({ hash });

  const after = await pub.getBalance({ address: account.address });
  console.log(`tx         ${hash}`);
  console.log(`explorer   https://explorer.sepolia.mantle.xyz/tx/${hash}`);
  console.log(`remaining  ${Number(after) / 1e18} MNT`);
}

main().catch((e) => { console.error(e); process.exit(1); });

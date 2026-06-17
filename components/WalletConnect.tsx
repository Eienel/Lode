"use client";

import { useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Wallet, X } from "@phosphor-icons/react";

// Short display form for a pubkey. Full value always on title/copy, never
// truncated for on-chain use.
const short = (pk: string) => `${pk.slice(0, 4)}...${pk.slice(-4)}`;

export function WalletConnect({ mock = false }: { mock?: boolean }) {
  const { publicKey, disconnect, connected } = useWallet();
  const { setVisible } = useWalletModal();

  // In mock mode no wallet should be live: tear down any session so payments
  // always fall through the mock path, and hide the connect control entirely.
  useEffect(() => {
    if (mock && connected) disconnect();
  }, [mock, connected, disconnect]);

  if (mock) return null;

  if (connected && publicKey) {
    return (
      <div className="flex items-center gap-1 rounded-full border border-line bg-paper-raised px-3 py-1.5">
        <Wallet size={13} className="text-good" />
        <span className="font-mono text-[11px] text-ink" title={publicKey.toBase58()}>
          {short(publicKey.toBase58())}
        </span>
        <button
          onClick={() => disconnect()}
          className="ml-1 text-ink-faint transition-colors hover:text-bad"
          title="Disconnect wallet"
        >
          <X size={12} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setVisible(true)}
      className="flex items-center gap-1.5 rounded-full border border-line bg-paper-raised px-3 py-1.5 text-[11px] font-medium text-ink transition-colors hover:border-line-strong"
    >
      <Wallet size={13} className="text-ink-faint" />
      connect wallet
    </button>
  );
}

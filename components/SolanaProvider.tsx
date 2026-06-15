"use client";

import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import "@solana/wallet-adapter-react-ui/styles.css";
import type { ComponentType } from "react";

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.mainnet-beta.solana.com";

// wallet-adapter ships older React FC types; cast to ComponentType to satisfy TS
const Conn = ConnectionProvider as ComponentType<{ endpoint: string; children: React.ReactNode }>;
const WProv = WalletProvider as ComponentType<{ wallets: unknown[]; autoConnect: boolean; children: React.ReactNode }>;
const Modal = WalletModalProvider as ComponentType<{ children: React.ReactNode }>;

export function SolanaProvider({ children }: { children: React.ReactNode }) {
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);
  return (
    <Conn endpoint={RPC}>
      <WProv wallets={wallets} autoConnect>
        <Modal>{children}</Modal>
      </WProv>
    </Conn>
  );
}

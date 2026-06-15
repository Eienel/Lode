"use client";

// Real on-chain payment using the connected Solana wallet. Supports paying in
// SOL (SystemProgram transfer) or USDC (SPL transfer). Falls back to mock when
// no wallet is connected. Never requests or displays private keys.

import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferInstruction } from "@solana/spl-token";
import { ArrowRight, CircleNotch } from "@phosphor-icons/react";
import type { ListedSignal } from "@/lib/types";
import { buySignal, buySignalOnChain } from "@/app/actions";

const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
// Approximate SOL price for USDC conversion — good enough for a demo; a real
// build would fetch this from a price oracle.
const SOL_PRICE_USD = 150;

interface Props {
  signal: ListedSignal;
  onSuccess: (result: Awaited<ReturnType<typeof buySignal>>) => void;
}

export function PayButton({ signal, onSuccess }: Props) {
  const { publicKey, sendTransaction, connected } = useWallet();
  const { connection } = useConnection();
  const [token, setToken] = useState<"SOL" | "USDC">("USDC");
  const [state, setState] = useState<"idle" | "paying">("idle");

  async function handleMockBuy() {
    setState("paying");
    try {
      const res = await buySignal(signal.id);
      await new Promise((r) => setTimeout(r, 650));
      onSuccess(res);
    } finally {
      setState("idle");
    }
  }

  async function handleOnChainBuy() {
    if (!publicKey) return handleMockBuy();
    setState("paying");
    try {
      const merchant = new PublicKey(signal.merchantAgent);
      const tx = new Transaction();

      if (token === "SOL") {
        const lamports = Math.ceil((signal.priceUsdc / SOL_PRICE_USD) * LAMPORTS_PER_SOL);
        tx.add(SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: merchant, lamports }));
      } else {
        // USDC SPL transfer
        const buyerAta = await getAssociatedTokenAddress(USDC_MINT, publicKey);
        const merchantAta = await getAssociatedTokenAddress(USDC_MINT, merchant);
        // Create merchant ATA if it doesn't exist
        const merchantAtaInfo = await connection.getAccountInfo(merchantAta);
        if (!merchantAtaInfo) {
          tx.add(createAssociatedTokenAccountInstruction(publicKey, merchantAta, merchant, USDC_MINT));
        }
        const amount = BigInt(Math.ceil(signal.priceUsdc * 1_000_000)); // 6 decimals
        tx.add(createTransferInstruction(buyerAta, merchantAta, publicKey, amount));
      }

      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");

      const res = await buySignalOnChain(signal.id, publicKey.toBase58(), sig);
      onSuccess(res);
    } catch (e) {
      console.error(e);
      setState("idle");
    }
  }

  const isBusy = state === "paying";

  return (
    <div className="space-y-2">
      {connected && (
        <div className="flex items-center gap-1 rounded-md border border-line bg-paper-sunken p-1">
          {(["USDC", "SOL"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setToken(t)}
              className={`flex-1 rounded py-1 text-[11px] font-medium transition-colors ${
                token === t ? "bg-ink text-paper" : "text-ink-faint hover:text-ink"
              }`}
            >
              pay in {t}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={connected ? handleOnChainBuy : handleMockBuy}
        disabled={isBusy}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-ink px-4 py-2.5 text-[13px] font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-70"
      >
        {isBusy ? (
          <>
            <CircleNotch size={15} className="animate-spin" />
            {connected ? "confirming on-chain" : "settling payment"}
          </>
        ) : (
          <>
            {connected ? "pay and unlock" : "buy and unlock"}
            <span className="font-mono tnum">{signal.priceUsdc} usdc</span>
            <ArrowRight size={14} />
          </>
        )}
      </button>
    </div>
  );
}

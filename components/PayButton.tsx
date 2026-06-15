"use client";

// On-chain payment using the connected Solana wallet. Supports SOL (native
// transfer) or USDC (SPL token transfer). Falls back to mock when no wallet
// is connected. Never requests or displays private keys. All position ops
// stay --dry-run. This only moves the signal price (a small USDC amount, e.g.
// $2 to $12) to the merchant agent to unlock the alpha.

import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import {
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
} from "@solana/spl-token";
import { ArrowRight, CircleNotch, ShieldCheck } from "@phosphor-icons/react";
import type { ListedSignal } from "@/lib/types";
import { buySignal, buySignalOnChain } from "@/app/actions";

const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

// Fetch SOL/USD price from Byreal overview rather than hardcoding.
async function fetchSolPrice(): Promise<number> {
  try {
    const res = await fetch("/api/sol-price", { cache: "no-store" });
    if (res.ok) return (await res.json()).price as number;
  } catch {}
  return 150; // fallback if the price fetch fails
}

interface Props {
  signal: ListedSignal;
  onSuccess: (result: Awaited<ReturnType<typeof buySignal>>) => void;
  mock?: boolean;
}

export function PayButton({ signal, onSuccess, mock }: Props) {
  const { publicKey, sendTransaction, connected } = useWallet();
  const { connection } = useConnection();
  const [token, setToken] = useState<"SOL" | "USDC">("USDC");
  const [state, setState] = useState<"idle" | "paying" | "confirming">("idle");
  const [error, setError] = useState<string>("");

  async function handleMockBuy() {
    setState("paying");
    setError("");
    try {
      const res = await buySignal(signal.id, mock);
      await new Promise((r) => setTimeout(r, 600));
      onSuccess(res);
    } catch (e) {
      setError("Payment failed. Try again.");
      console.error(e);
    } finally {
      setState("idle");
    }
  }

  async function handleOnChainBuy() {
    if (!publicKey) return handleMockBuy();
    setState("paying");
    setError("");
    try {
      const tx = new Transaction();

      if (token === "SOL") {
        const solPrice = await fetchSolPrice();
        const lamports = Math.ceil((signal.priceUsdc / solPrice) * LAMPORTS_PER_SOL);
        const merchant = new PublicKey(signal.merchantAgent);
        tx.add(SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: merchant, lamports }));
      } else {
        // USDC SPL transfer: amount in micro-USDC (6 decimals)
        const merchant = new PublicKey(signal.merchantAgent);
        const buyerAta = await getAssociatedTokenAddress(USDC_MINT, publicKey);
        const merchantAta = await getAssociatedTokenAddress(USDC_MINT, merchant);
        const merchantAtaInfo = await connection.getAccountInfo(merchantAta);
        if (!merchantAtaInfo) {
          tx.add(
            createAssociatedTokenAccountInstruction(
              publicKey,
              merchantAta,
              merchant,
              USDC_MINT,
            ),
          );
        }
        const amount = BigInt(Math.ceil(signal.priceUsdc * 1_000_000));
        tx.add(createTransferInstruction(buyerAta, merchantAta, publicKey, amount));
      }

      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      setState("confirming");
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");

      const res = await buySignalOnChain(signal.id, publicKey.toBase58(), sig, mock);
      onSuccess(res);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      // User rejected in wallet is not an error worth surfacing loudly
      if (!msg.includes("rejected") && !msg.includes("cancelled")) {
        setError("Transaction failed. Check your balance and try again.");
      }
      console.error(e);
      setState("idle");
    }
  }

  const isBusy = state !== "idle";

  return (
    <div className="space-y-2">
      {/* Mainnet warning shown only when wallet is connected */}
      {connected && (
        <div className="flex items-start gap-1.5 rounded-md bg-paper-sunken px-2.5 py-2 text-[11px] leading-relaxed text-ink-soft">
          <ShieldCheck size={12} className="mt-0.5 shrink-0 text-good" />
          <span>
            Paying on Solana mainnet. Only {token === "USDC" ? `${signal.priceUsdc} USDC` : "a small amount of SOL"} moves to unlock the signal. Execution stays dry-run.
          </span>
        </div>
      )}

      {/* Token picker: only shown when wallet is connected */}
      {connected && (
        <div className="flex items-center gap-0.5 rounded-md border border-line bg-paper-sunken p-0.5">
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
            {state === "confirming" ? "confirming on-chain" : connected ? "sending transaction" : "settling payment"}
          </>
        ) : (
          <>
            {connected ? "pay on-chain and unlock" : "buy and unlock"}
            <span className="font-mono tnum">{signal.priceUsdc} usdc</span>
            <ArrowRight size={14} />
          </>
        )}
      </button>

      {error && (
        <p className="text-center text-[11px] text-bad">{error}</p>
      )}
    </div>
  );
}

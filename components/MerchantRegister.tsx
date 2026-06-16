"use client";

// Merchant registration. Connect a wallet, pay the 25 USDC registration fee to
// the Lode treasury, and submit your agent details for review. Never requests
// or displays private keys. The agent key you list can differ from the wallet
// you pay with (you might sign signals with a separate agent identity).

import { useState } from "react";
import dynamic from "next/dynamic";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
} from "@solana/spl-token";
import { ShieldCheck, CircleNotch, ArrowRight, Check } from "@phosphor-icons/react";
import { MERCHANT_TIERS } from "@/lib/types";

const WalletConnect = dynamic(() => import("./WalletConnect").then((m) => m.WalletConnect), { ssr: false });

const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const TREASURY = new PublicKey(
  process.env.NEXT_PUBLIC_LODE_TREASURY ?? "5EhEKnYin2nhs3CUReoYFmaUySRaYZnNrnCqZmc4TV76",
);

type State = "idle" | "paying" | "confirming" | "submitting" | "done" | "error" | "exists";

export function MerchantRegister() {
  const { publicKey, sendTransaction, connected } = useWallet();
  const { connection } = useConnection();
  const [label, setLabel] = useState("");
  const [bio, setBio] = useState("");
  const [agentPubkey, setAgentPubkey] = useState("");
  const [tier, setTier] = useState<number>(MERCHANT_TIERS[0].usd);
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState("");

  const feeUsdc = tier;

  const effectiveAgent = agentPubkey.trim() || publicKey?.toBase58() || "";
  const canSubmit = connected && label.trim() && bio.trim() && effectiveAgent && state === "idle";

  async function handleRegister() {
    if (!publicKey) return;
    setError("");
    setState("paying");
    try {
      const tx = new Transaction();
      const buyerAta = await getAssociatedTokenAddress(USDC_MINT, publicKey);
      const treasuryAta = await getAssociatedTokenAddress(USDC_MINT, TREASURY);
      const treasuryAtaInfo = await connection.getAccountInfo(treasuryAta);
      if (!treasuryAtaInfo) {
        tx.add(createAssociatedTokenAccountInstruction(publicKey, treasuryAta, TREASURY, USDC_MINT));
      }
      const amount = BigInt(feeUsdc * 1_000_000);
      tx.add(createTransferInstruction(buyerAta, treasuryAta, publicKey, amount));

      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      setState("confirming");
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");

      setState("submitting");
      const res = await fetch("/api/register-merchant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pubkey: effectiveAgent, label: label.trim(), bio: bio.trim(), tx: sig, tier }),
      });
      if (res.status === 409) {
        setState("exists");
        return;
      }
      if (!res.ok) throw new Error("Registration failed");
      setState("done");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("rejected") || msg.includes("cancelled")) {
        setState("idle");
        return;
      }
      setError("Registration failed. Check your USDC balance and try again.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-card border border-line bg-paper-raised p-6 shadow-card">
        <div className="flex items-center gap-2 text-good">
          <Check size={18} weight="bold" />
          <span className="text-[15px] font-semibold text-ink">Registration submitted</span>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
          Your fee is paid and your application is pending review. Once approved, your signals will appear in the public catalog. You can start mining and signing signals with your agent key now.
        </p>
      </div>
    );
  }

  if (state === "exists") {
    return (
      <div className="rounded-card border border-line bg-paper-raised p-6 shadow-card">
        <p className="text-[14px] font-medium text-ink">Already registered</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">
          This agent key is already in the registry. No second fee is needed.
        </p>
      </div>
    );
  }

  const isBusy = state === "paying" || state === "confirming" || state === "submitting";

  return (
    <div className="rounded-card border border-line bg-paper-raised p-6 shadow-card">
      {!connected ? (
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-ink-soft">Connect a wallet to pay the registration fee.</p>
          <WalletConnect />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Field label="merchant name">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Helios alpha"
              maxLength={48}
              className="w-full rounded-md border border-line bg-paper-sunken px-3 py-2 text-[13px] text-ink outline-none focus:border-line-strong"
            />
          </Field>

          <Field label="what you mine">
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A short description of the pools and strategies your agent covers."
              maxLength={280}
              rows={3}
              className="w-full resize-none rounded-md border border-line bg-paper-sunken px-3 py-2 text-[13px] text-ink outline-none focus:border-line-strong"
            />
          </Field>

          <Field label="agent key (defaults to your wallet)">
            <input
              value={agentPubkey}
              onChange={(e) => setAgentPubkey(e.target.value)}
              placeholder={publicKey?.toBase58() ?? ""}
              className="w-full rounded-md border border-line bg-paper-sunken px-3 py-2 font-mono text-[12px] text-ink outline-none focus:border-line-strong"
            />
          </Field>

          <Field label="tier">
            <div className="flex flex-col gap-2">
              {MERCHANT_TIERS.map((t) => (
                <button
                  key={t.usd}
                  type="button"
                  onClick={() => setTier(t.usd)}
                  className={`flex items-center justify-between rounded-md border px-3 py-2.5 text-left transition-colors ${
                    tier === t.usd ? "border-ink bg-paper" : "border-line bg-paper-sunken hover:border-line-strong"
                  }`}
                >
                  <div>
                    <span className="text-[13px] font-semibold text-ink">{t.label}</span>
                    <p className="text-[11px] text-ink-soft">list up to {t.signals} signals on the dashboard</p>
                  </div>
                  <span className="font-mono text-[13px] tnum text-ink">{t.usd} usdc</span>
                </button>
              ))}
            </div>
          </Field>

          <div className="flex items-start gap-1.5 rounded-md bg-paper-sunken px-2.5 py-2 text-[11px] leading-relaxed text-ink-soft">
            <ShieldCheck size={12} className="mt-0.5 shrink-0 text-good" />
            <span>
              You pay {feeUsdc} USDC on Solana mainnet to register. Lode keeps a 20% platform fee on each signal you sell; you keep 80%.
            </span>
          </div>

          <button
            onClick={handleRegister}
            disabled={!canSubmit}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-ink px-4 py-2.5 text-[13px] font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isBusy ? (
              <>
                <CircleNotch size={15} className="animate-spin" />
                {state === "confirming" ? "confirming on-chain" : state === "submitting" ? "submitting" : "sending transaction"}
              </>
            ) : (
              <>
                pay and register
                <span className="font-mono tnum">{feeUsdc} usdc</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>

          {error && <p className="text-center text-[11px] text-bad">{error}</p>}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">{label}</span>
      {children}
    </label>
  );
}

"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LockSimple, ShieldCheck, Sparkle, ArrowRight, CircleNotch, Lightning } from "@phosphor-icons/react";
import type { AlphaSignal, ListedSignal } from "@/lib/types";
import { buySignal } from "@/app/actions";
import { usd, pct, riskLabel, riskColor } from "@/lib/format";
import { RangeViz } from "./RangeViz";
import { AddressChip } from "./AddressChip";

type State = "locked" | "paying" | "unlocked";

export function SignalCard({ signal, onPurchased }: { signal: ListedSignal; onPurchased?: () => void }) {
  const [state, setState] = useState<State>("locked");
  const [full, setFull] = useState<AlphaSignal | null>(null);
  const [valid, setValid] = useState(false);
  const [tx, setTx] = useState<string>("");

  async function handleBuy() {
    setState("paying");
    try {
      const res = await buySignal(signal.id);
      // brief settle beat so the payment step reads as a real step
      await new Promise((r) => setTimeout(r, 650));
      setFull(res.signal);
      setValid(res.signatureValid);
      setTx(res.entry.txRef);
      setState("unlocked");
      onPurchased?.();
    } catch {
      setState("locked");
    }
  }

  return (
    <motion.div
      layout
      className="flex flex-col rounded-card border border-line bg-paper-raised shadow-card"
    >
      {/* header */}
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-semibold tracking-tight text-ink">{signal.pair}</h3>
            <span className={`text-[11px] font-medium ${riskColor(signal.riskScore)}`}>{riskLabel(signal.riskScore)}</span>
          </div>
          <p className="mt-0.5 font-mono text-[10px] text-ink-faint">{signal.poolAddr}</p>
        </div>
        <div className="text-right">
          <div className="font-mono text-lg font-semibold tnum text-good">{pct(signal.estFeeApr)}</div>
          <div className="text-[10px] text-ink-faint">est fee apr</div>
        </div>
      </div>

      {/* body */}
      <div className="flex flex-1 flex-col px-5 py-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <Metric label="price" value={current(signal.currentPrice)} />
          <Metric label="confidence" value={`${Math.round(signal.confidence * 100)}%`} />
          <Metric label="risk" value={`${signal.riskScore}`} />
        </div>

        <AnimatePresence mode="wait">
          {state !== "unlocked" ? (
            <motion.div key="teaser" exit={{ opacity: 0 }} className="mt-4 flex flex-1 flex-col">
              <div className="flex items-start gap-2 rounded-md bg-paper-sunken px-3 py-2.5 text-[13px] leading-relaxed text-ink-soft">
                <Sparkle size={14} className="mt-0.5 shrink-0 text-accent" />
                <span>{signal.teaser}</span>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-faint">
                <LockSimple size={12} />
                <span>recommended band, copy target and execution are sealed</span>
              </div>
            </motion.div>
          ) : (
            full && (
              <motion.div
                key="full"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 140, damping: 20 }}
                className="mt-4 flex flex-1 flex-col gap-4"
              >
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-good">
                  <ShieldCheck size={14} weight="fill" />
                  {valid ? "seal verified, signature valid" : "seal mismatch"}
                </div>

                <RangeViz
                  lower={full.recommendedRange.lower}
                  upper={full.recommendedRange.upper}
                  current={full.currentPrice}
                />

                <p className="text-[13px] leading-relaxed text-ink-soft">{full.rationale}</p>

                {full.copyTarget && (
                  <div className="rounded-md border border-line bg-paper-sunken p-3">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-[11px] font-medium text-ink">copy target</span>
                      <span className="text-[11px] text-ink-faint">
                        {usd(full.copyTarget.liquidityUsd)} · {full.copyTarget.copies} copies
                      </span>
                    </div>
                    <AddressChip value={full.copyTarget.positionAddress} label="position" />
                  </div>
                )}

                <div className="rounded-md border border-line bg-ink p-3">
                  <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-paper">
                    <Lightning size={12} weight="fill" /> ready to run, dry-run first
                  </div>
                  <code className="block break-all font-mono text-[11px] leading-relaxed text-paper-raised">{full.execCommand}</code>
                </div>

                <AddressChip value={tx} label="tx" />
              </motion.div>
            )
          )}
        </AnimatePresence>
      </div>

      {/* footer / action */}
      <div className="border-t border-line px-5 py-3.5">
        {state === "unlocked" ? (
          <div className="flex items-center justify-between text-[12px] text-ink-soft">
            <span>unlocked</span>
            <span className="font-mono tnum">paid {signal.priceUsdc} usdc</span>
          </div>
        ) : (
          <button
            onClick={handleBuy}
            disabled={state === "paying"}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-ink px-4 py-2.5 text-[13px] font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-70"
          >
            {state === "paying" ? (
              <>
                <CircleNotch size={15} className="animate-spin" /> settling payment
              </>
            ) : (
              <>
                buy and unlock
                <span className="font-mono tnum">{signal.priceUsdc} usdc</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        )}
      </div>
    </motion.div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-paper-sunken py-2">
      <div className="font-mono text-[13px] font-semibold tnum text-ink">{value}</div>
      <div className="text-[10px] text-ink-faint">{label}</div>
    </div>
  );
}

function current(p: number): string {
  return p < 1 ? p.toPrecision(3) : p < 1000 ? p.toFixed(2) : Math.round(p).toLocaleString();
}

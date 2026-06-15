"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LockSimple, ShieldCheck, Sparkle, CircleNotch, Lightning, Play, Copy, Check, Terminal, Warning } from "@phosphor-icons/react";
import type { AlphaSignal, ListedSignal } from "@/lib/types";
import { executeCommand } from "@/app/actions";
import { buySignal } from "@/app/actions";
import { usd, pct, riskLabel, riskColor } from "@/lib/format";
import { RangeViz } from "./RangeViz";
import { AddressChip } from "./AddressChip";
import { PayButton } from "./PayButton";

type State = "locked" | "paying" | "unlocked";

export function SignalCard({ signal, onPurchased, mock }: { signal: ListedSignal; onPurchased?: () => void; mock?: boolean }) {
  const [state, setState] = useState<State>("locked");
  const [full, setFull] = useState<AlphaSignal | null>(null);
  const [valid, setValid] = useState(false);
  const [tx, setTx] = useState<string>("");
  const [execOutput, setExecOutput] = useState<string>("");
  const [executing, setExecuting] = useState(false);

  function handleSuccess(res: Awaited<ReturnType<typeof buySignal>>) {
    setFull(res.signal);
    setValid(res.signatureValid);
    setTx(res.entry.txRef);
    setState("unlocked");
    onPurchased?.();
  }

  async function handleExecute() {
    if (!full) return;
    setExecuting(true);
    setExecOutput("");
    try {
      const out = await executeCommand(full.execCommand);
      setExecOutput(out);
    } catch (e) {
      setExecOutput(String(e));
    } finally {
      setExecuting(false);
    }
  }

  return (
    <motion.div layout className="flex flex-col rounded-card border border-line bg-paper-raised shadow-card">
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
          <Metric label="price" value={displayPrice(signal.currentPrice)} />
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

                <RangeViz lower={full.recommendedRange.lower} upper={full.recommendedRange.upper} current={full.currentPrice} />

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

                <button
                  onClick={handleExecute}
                  disabled={executing}
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-line bg-paper-sunken px-4 py-2 text-[12px] font-medium text-ink transition-colors hover:bg-paper-raised disabled:opacity-60"
                >
                  {executing ? <><CircleNotch size={13} className="animate-spin" /> running dry-run</> : <><Play size={13} weight="fill" /> run dry-run now</>}
                </button>

                {execOutput && (
                  <pre className="max-h-48 overflow-auto rounded-md border border-line bg-paper-sunken p-3 font-mono text-[10px] leading-relaxed text-ink-soft whitespace-pre-wrap">
                    {execOutput}
                  </pre>
                )}

                <AddressChip value={tx} label="tx" />

                {/* Open for real */}
                {execOutput && <ConfirmCard signal={full} />}
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
          <PayButton signal={signal} onSuccess={handleSuccess} mock={mock} />
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

function displayPrice(p: number): string {
  return p < 1 ? p.toPrecision(3) : p < 1000 ? p.toFixed(2) : Math.round(p).toLocaleString();
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-ink-faint transition-colors hover:text-ink"
    >
      {copied ? <><Check size={11} className="text-good" /> copied</> : <><Copy size={11} /> copy</>}
    </button>
  );
}

function ConfirmCard({ signal }: { signal: AlphaSignal }) {
  const confirmCmd = signal.execCommand.replace("--dry-run", "--confirm");
  const checklist = [
    "byreal-cli installed: npm install -g @byreal-io/byreal-cli",
    "wallet configured: byreal-cli setup",
    "at least 0.03 SOL in wallet for position open fee",
    "correct token pair available in your wallet",
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 140, damping: 20 }}
      className="rounded-md border border-line bg-paper-raised p-4 flex flex-col gap-3"
    >
      <div className="flex items-center gap-1.5">
        <Terminal size={13} className="text-ink" />
        <span className="text-[12px] font-medium text-ink">open position in your terminal</span>
      </div>

      <p className="text-[11px] leading-relaxed text-ink-soft">
        The dry-run above ran on our servers without touching your wallet. To open a real position, run this command in your own terminal with byreal-cli installed and your wallet configured.
      </p>

      <div className="rounded-md border border-line bg-ink p-3">
        <div className="mb-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1 text-[10px] font-medium text-paper-raised">
            <Warning size={11} weight="fill" className="text-yellow-400" />
            runs for real, not a dry-run
          </div>
          <CopyButton text={confirmCmd} />
        </div>
        <code className="block break-all font-mono text-[11px] leading-relaxed text-paper-raised">
          {confirmCmd}
        </code>
      </div>

      <div className="rounded-md bg-paper-sunken px-3 py-2.5">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-ink-faint">before you run</p>
        <ul className="flex flex-col gap-1.5">
          {checklist.map((item) => (
            <li key={item} className="flex items-start gap-2 text-[11px] text-ink-soft">
              <ShieldCheck size={12} className="mt-0.5 shrink-0 text-good" weight="fill" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}

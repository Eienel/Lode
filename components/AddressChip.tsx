"use client";

import { useState } from "react";
import { Copy, Check } from "@phosphor-icons/react";

// Shows the full on-chain string (never truncated, per the CLI rules), in mono,
// with a one-tap copy. Long values wrap rather than being cut.
export function AddressChip({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="group inline-flex max-w-full items-start gap-1.5 rounded-md border border-line bg-paper-sunken px-2 py-1 text-left font-mono text-[11px] leading-tight text-ink-soft transition-colors hover:border-line-strong"
      title={value}
    >
      {label && <span className="shrink-0 text-ink-faint">{label}</span>}
      <span className="break-all">{value}</span>
      {copied ? (
        <Check size={12} weight="bold" className="mt-0.5 shrink-0 text-good" />
      ) : (
        <Copy size={12} className="mt-0.5 shrink-0 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </button>
  );
}

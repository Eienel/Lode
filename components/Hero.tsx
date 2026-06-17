"use client";

import { ArrowRight, Seal, ShoppingCart, CheckCircle, Play, Wrench } from "@phosphor-icons/react";
import type { Overview } from "@/lib/types";
import { usd } from "@/lib/format";

const LOOP_STEPS = [
  { icon: Wrench,       label: "mine",    desc: "Byreal CLMM pools"        },
  { icon: Seal,         label: "seal",    desc: "ed25519 signed signal"     },
  { icon: ShoppingCart, label: "sell",    desc: "listed on catalog"         },
  { icon: CheckCircle,  label: "verify",  desc: "buyer checks seal"         },
  { icon: Play,         label: "execute", desc: "dry-run then confirm"      },
];

export function Hero({
  overview,
  signalCount,
  economyVolume,
  mock,
  onBrowse,
}: {
  overview: Overview;
  signalCount: number;
  economyVolume: number;
  mock: boolean;
  onBrowse: () => void;
}) {
  return (
    <section className="mb-14 border-b border-line pb-14">
      {/* headline */}
      <div className="max-w-2xl">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-ink-faint">
          agent-to-agent economy
        </p>
        <h1 className="text-[26px] sm:text-[38px] font-semibold leading-[1.15] tracking-tight text-ink">
          An alpha market where agents mine, seal, and sell Byreal intelligence.
        </h1>
        <p className="mt-4 max-w-xl text-[14px] sm:text-[15px] leading-relaxed text-ink-soft">
          A merchant agent mines Byreal CLMM pools, packages each finding as a signed alpha signal, and sells it wallet-to-wallet. Buyers verify the ed25519 seal before paying. Every trade settles on-chain and lands in the economy ledger.
        </p>

        {/* CTAs */}
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <button
            onClick={onBrowse}
            className="flex items-center gap-2 rounded-md bg-ink px-5 py-2.5 text-[13px] font-medium text-paper transition-opacity hover:opacity-90"
          >
            browse signals
            <ArrowRight size={14} />
          </button>
          <a
            href="/register"
            className="flex items-center gap-2 rounded-md border border-line bg-paper-raised px-5 py-2.5 text-[13px] font-medium text-ink transition-colors hover:border-line-strong"
          >
            run a merchant
            <ArrowRight size={14} />
          </a>
        </div>
      </div>

      {/* loop diagram (hidden on small screens where it wraps awkwardly) */}
      <div className="mt-12 hidden sm:block">
        <div className="flex flex-wrap items-start justify-start gap-y-6">
          {LOOP_STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={step.label} className="flex items-start">
                <div className="flex w-24 flex-col items-center gap-2 sm:w-28">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-paper-raised shadow-card">
                    <Icon size={18} className="text-ink-soft" />
                  </div>
                  <span className="text-[12px] font-semibold text-ink">{step.label}</span>
                  <span className="text-center text-[10px] leading-snug text-ink-faint">{step.desc}</span>
                </div>
                {i < LOOP_STEPS.length - 1 && (
                  <div className="mt-5 flex items-center">
                    <div className="h-px w-5 border-t border-dashed border-line-strong sm:w-8" />
                    <ArrowRight size={10} className="text-ink-faint" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* live stat strip */}
      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatPill label="byreal tvl"      value={usd(overview.tvl)}            live />
        <StatPill label="24h volume"      value={usd(overview.volume_24h_usd)} live />
        <StatPill label="signals listed"  value={`${signalCount}`}             />
        <StatPill
          label={mock ? "mock volume" : "live volume"}
          value={usd(economyVolume)}
          live={!mock}
        />
      </div>
    </section>
  );
}

function StatPill({ label, value, live }: { label: string; value: string; live?: boolean }) {
  return (
    <div className="rounded-card border border-line bg-paper-raised px-4 py-3 shadow-card">
      <div className="flex items-center gap-1.5">
        {live && <span className="h-1.5 w-1.5 rounded-full bg-good" />}
        <span className="text-[11px] text-ink-faint">{label}</span>
      </div>
      <div className="mt-1 font-mono text-[18px] font-semibold tnum text-ink">{value}</div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Stack, Pulse, Receipt, FlowArrow, Cube, ArrowRight } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import type { ListedSignal, LedgerEntry, AgentReputation, Overview } from "@/lib/types";
import { SignalCard } from "./SignalCard";
import { refreshFeed } from "@/app/actions";
import { usd } from "@/lib/format";

// Client-only components that use browser APIs or wallet state.
const WalletConnect = dynamic(() => import("./WalletConnect").then((m) => m.WalletConnect), { ssr: false });
const Onboarding = dynamic(() => import("./Onboarding").then((m) => m.Onboarding), { ssr: false });

export function Dashboard({
  signals,
  overview,
  ledger: initialLedger,
  reputation: initialRep,
  merchant,
  mantleAgentId,
  mantleExplorer,
  mantleRegistered,
  mock,
  pendingCount,
}: {
  signals: ListedSignal[];
  overview: Overview;
  ledger: LedgerEntry[];
  reputation: AgentReputation[];
  merchant: string;
  mantleAgentId: string;
  mantleExplorer: string | null;
  mantleRegistered: boolean;
  mock: boolean;
  pendingCount?: number;
}) {
  const [ledger, setLedger] = useState(initialLedger);
  const [reputation, setReputation] = useState(initialRep);
  const router = useRouter();

  function handleModeChoice(mode: "live" | "mock") {
    router.push(mode === "mock" ? "/?mode=mock" : "/");
  }

  async function onPurchased() {
    const f = await refreshFeed();
    setLedger(f.ledger);
    setReputation(f.reputation);
  }

  const merchantRep = reputation.find((r) => r.agent === merchant);

  // Show the economy for the mode you are viewing: live = real on-chain (solana)
  // earnings, mock = mock settlements. Each entry is tagged by backend already.
  const modeLedger = ledger.filter((e) => (mock ? e.backend === "mock" : e.backend === "solana"));
  const economyVolume = modeLedger.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <Onboarding onChoose={handleModeChoice} />
      {/* header */}
      <header className="mb-10">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Cube size={20} weight="fill" className="text-accent" />
            <span className="text-[15px] font-semibold tracking-tight">Lode</span>
          </div>

          {/* live / mock toggle */}
          <div className="flex items-center gap-0.5 rounded-full border border-line bg-paper-sunken p-0.5">
            <button
              onClick={() => router.push("/?mode=live")}
              className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                !mock ? "bg-ink text-paper" : "text-ink-faint hover:text-ink"
              }`}
            >
              live byreal
            </button>
            <button
              onClick={() => router.push("/?mode=mock")}
              className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                mock ? "bg-ink text-paper" : "text-ink-faint hover:text-ink"
              }`}
            >
              mock data
            </button>
          </div>

          {/* wallet connect (live mode only) */}
          <div className="ml-auto">
            <WalletConnect mock={mock} />
          </div>
        </div>

        <h1 className="mt-5 max-w-2xl text-[28px] font-semibold leading-tight tracking-tight text-ink">
          An agent-to-agent alpha market on Byreal
        </h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-soft">
          A merchant agent mines Byreal CLMM pools for the best liquidity ranges and top farmers, seals each
          recommendation with its own key, and sells it wallet-to-wallet to buyer agents who verify, pay, and execute.
        </p>
      </header>

      {/* market stats */}
      <section className="mb-10 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat icon={<Stack size={15} />} label="byreal tvl" value={usd(overview.tvl)} />
        <Stat icon={<Pulse size={15} />} label="24h volume" value={usd(overview.volume_24h_usd)} />
        <Stat icon={<FlowArrow size={15} />} label="signals listed" value={`${signals.length}`} />
        <Stat icon={<Receipt size={15} />} label={mock ? "mock volume" : "live volume"} value={usd(economyVolume)} />
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        {/* marketplace */}
        <section>
          <SectionTitle>Alpha signals</SectionTitle>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {signals.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, type: "spring", stiffness: 120, damping: 20 }}
              >
                <SignalCard signal={s} onPurchased={onPurchased} mock={mock} />
              </motion.div>
            ))}
          </div>
        </section>

        {/* sidebar */}
        <aside className="flex flex-col gap-8">
          <div>
            <SectionTitle>Agents</SectionTitle>
            <div className="flex flex-col gap-3">
              <AgentCard
                rep={merchantRep ?? { agent: merchant, label: "Lode merchant", role: "merchant", sales: 0, revenue: 0 }}
                mantleAgentId={mantleAgentId}
                mantleExplorer={mantleExplorer}
                mantleRegistered={mantleRegistered}
                primary
              />
              {reputation
                .filter((r) => r.role === "buyer")
                .slice(0, 3)
                .map((r) => (
                  <AgentCard key={r.agent} rep={r} />
                ))}
            </div>
          </div>

          <div>
            <SectionTitle>Run a merchant</SectionTitle>
            <div className="rounded-card border border-line bg-paper-raised p-4 shadow-card">
              <p className="text-[13px] font-medium text-ink">List your own signals</p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">
                Mine Byreal pools, seal your signals, and sell intelligence to buyer agents. From 5 usdc, 5% platform fee.
              </p>
              <a href="/register" className="mt-3 flex items-center gap-1.5 text-[12px] font-medium text-accent hover:underline">
                Apply to become a merchant <ArrowRight size={12} />
              </a>
              {!!pendingCount && (
                <p className="mt-2 text-[10px] text-ink-faint">{pendingCount} pending approval</p>
              )}
            </div>
          </div>

          <div>
            <SectionTitle>Economy ledger</SectionTitle>
            <div className="rounded-card border border-line bg-paper-raised shadow-card">
              {modeLedger.length === 0 ? (
                <p className="px-4 py-6 text-center text-[12px] text-ink-faint">
                  no {mock ? "mock" : "live"} purchases yet. buy a signal to settle the first agent-to-agent trade.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {modeLedger.slice(0, 8).map((e, i) => (
                    <motion.li
                      key={e.txRef + i}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between px-4 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="text-[12px] font-medium text-ink">{e.pair}</div>
                        <div className="truncate font-mono text-[10px] text-ink-faint" title={e.txRef}>{e.txRef.slice(0, 24)}…</div>
                      </div>
                      <div className="ml-3 shrink-0 text-right">
                        <div className="font-mono text-[12px] tnum text-good">{e.amount} usdc</div>
                        <div className={`text-[10px] ${e.backend === "solana" ? "text-accent font-medium" : "text-ink-faint"}`}>{e.backend}</div>
                      </div>
                    </motion.li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </aside>
      </div>

      <footer className="mt-16 border-t border-line pt-6 text-[11px] text-ink-faint">
        Built on the Byreal Skills CLI for the Turing Test Hackathon. Every signal is sealed with ed25519 and priced in
        usdc. Execution always previews with dry-run first.
      </footer>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-card border border-line bg-paper-raised px-4 py-3 shadow-card">
      <div className="flex items-center gap-1.5 text-ink-faint">
        {icon}
        <span className="text-[11px]">{label}</span>
      </div>
      <div className="mt-1.5 font-mono text-[18px] font-semibold tnum text-ink">{value}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 text-[12px] font-medium uppercase tracking-wider text-ink-faint">{children}</h2>;
}

function AgentCard({
  rep,
  primary,
  mantleAgentId,
  mantleExplorer,
  mantleRegistered,
}: {
  rep: AgentReputation;
  primary?: boolean;
  mantleAgentId?: string;
  mantleExplorer?: string | null;
  mantleRegistered?: boolean;
}) {
  return (
    <div className={`rounded-card border p-4 shadow-card ${primary ? "border-line-strong bg-paper-raised" : "border-line bg-paper-raised"}`}>
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-ink">{rep.label}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] ${primary ? "bg-accent/10 text-accent" : "bg-paper-sunken text-ink-faint"}`}>
          {rep.role}
        </span>
      </div>
      <p className="mt-1.5 break-all font-mono text-[10px] text-ink-faint">{rep.agent}</p>
      {mantleAgentId && (
        <a
          href={mantleExplorer ?? "#"}
          target="_blank"
          rel="noreferrer"
          className="mt-2 flex items-center gap-1.5 rounded-md bg-paper-sunken px-2 py-1 transition-colors hover:bg-paper-sunken/70"
        >
          <Cube size={11} className="text-accent" />
          <span className="text-[10px] text-ink-faint">
            {mantleRegistered ? "mantle erc-8004, registered" : "mantle erc-8004"}
          </span>
          <span className="ml-auto font-mono text-[10px] text-ink">agent #{mantleAgentId}</span>
        </a>
      )}
      {rep.role === "merchant" && (
        <div className="mt-3 flex gap-4">
          <div>
            <div className="font-mono text-[14px] font-semibold tnum text-ink">{rep.sales}</div>
            <div className="text-[10px] text-ink-faint">sales</div>
          </div>
          <div>
            <div className="font-mono text-[14px] font-semibold tnum text-ink">{usd(rep.revenue)}</div>
            <div className="text-[10px] text-ink-faint">revenue</div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, Cube, ArrowRight, Sparkle } from "@phosphor-icons/react";

const KEY = "lode_mode_chosen";

interface Props {
  onChoose: (mode: "live" | "mock") => void;
}

export function Onboarding({ onChoose }: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Only show on first visit
    if (!localStorage.getItem(KEY)) setShow(true);
  }, []);

  function choose(mode: "live" | "mock") {
    localStorage.setItem(KEY, mode);
    setShow(false);
    onChoose(mode);
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ type: "spring", stiffness: 140, damping: 22 }}
            className="w-full max-w-md rounded-card border border-line bg-paper-raised p-8 shadow-lift"
          >
            <div className="flex items-center gap-2 mb-6">
              <Cube size={18} weight="fill" className="text-accent" />
              <span className="text-[14px] font-semibold tracking-tight text-ink">Lode</span>
            </div>

            <h2 className="text-[22px] font-semibold leading-tight tracking-tight text-ink">
              How do you want to explore?
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
              Lode runs two modes. You can switch between them anytime using the toggle at the top of the page.
            </p>

            <div className="mt-6 flex flex-col gap-3">
              {/* Mainnet option */}
              <button
                onClick={() => choose("live")}
                className="group flex items-start gap-4 rounded-card border border-line-strong bg-paper p-4 text-left transition-colors hover:border-ink hover:bg-paper-raised"
              >
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-paper-raised">
                  <Wallet size={16} className="text-ink" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-ink">Live mode</span>
                    <ArrowRight size={14} className="text-ink-faint transition-transform group-hover:translate-x-0.5" />
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">
                    Real Byreal pool data. Connect a Solana wallet to pay with SOL or USDC on mainnet. Dry-run execution only, no positions are opened without your explicit confirm.
                  </p>
                </div>
              </button>

              {/* Mock option */}
              <button
                onClick={() => choose("mock")}
                className="group flex items-start gap-4 rounded-card border border-line bg-paper p-4 text-left transition-colors hover:border-ink hover:bg-paper-raised"
              >
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-paper-raised">
                  <Sparkle size={16} className="text-ink-faint" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-ink">Mock mode</span>
                    <ArrowRight size={14} className="text-ink-faint transition-transform group-hover:translate-x-0.5" />
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">
                    Realistic fixture data, instant payments, no wallet needed. Everything works the same way, nothing touches mainnet. Good for exploring the agent economy without any setup.
                  </p>
                </div>
              </button>
            </div>

            <p className="mt-5 text-center text-[11px] text-ink-faint">
              You can switch between modes anytime using the live / mock toggle in the header.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

"use client";

import { motion } from "framer-motion";

// A calm CLMM range visualization: the recommended liquidity band drawn against
// the current price and the day low/high. No gridlines noise, editorial.
export function RangeViz({
  lower,
  upper,
  current,
  dayLow,
  dayHigh,
}: {
  lower: number;
  upper: number;
  current: number;
  dayLow?: number;
  dayHigh?: number;
}) {
  // axis spans a bit beyond the band so it never clips
  const pad = (upper - lower) * 0.35;
  const min = Math.min(lower, dayLow ?? lower) - pad;
  const max = Math.max(upper, dayHigh ?? upper) + pad;
  const span = max - min || 1;
  const x = (v: number) => ((v - min) / span) * 100;

  const bandL = x(lower);
  const bandW = x(upper) - x(lower);
  const cur = x(current);

  return (
    <div className="w-full">
      <div className="relative h-16">
        {/* baseline */}
        <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-line" />

        {/* day range, faint */}
        {dayLow !== undefined && dayHigh !== undefined && (
          <div
            className="absolute top-1/2 h-6 -translate-y-1/2 rounded-sm border border-dashed border-line-strong"
            style={{ left: `${x(dayLow)}%`, width: `${x(dayHigh) - x(dayLow)}%` }}
          />
        )}

        {/* recommended band */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
          style={{ left: `${bandL}%`, width: `${bandW}%`, transformOrigin: "left" }}
          className="absolute top-1/2 h-8 -translate-y-1/2 rounded-md border border-accent/40 bg-accent/10"
        />

        {/* current price marker */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 18 }}
          style={{ left: `${cur}%` }}
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          <div className="h-10 w-0.5 bg-ink" />
          <div className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] text-ink">
            {current.toFixed(current < 1 ? 6 : 2)}
          </div>
        </motion.div>
      </div>

      <div className="mt-5 flex justify-between font-mono text-[10px] text-ink-faint tnum">
        <span>{lower.toFixed(lower < 1 ? 6 : 2)}</span>
        <span className="text-accent">recommended band</span>
        <span>{upper.toFixed(upper < 1 ? 6 : 2)}</span>
      </div>
    </div>
  );
}

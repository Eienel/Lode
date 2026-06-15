import type { Metadata } from "next";
import dynamic from "next/dynamic";
import "./globals.css";

const SolanaProvider = dynamic(
  () => import("@/components/SolanaProvider").then((m) => m.SolanaProvider),
  { ssr: false },
);

export const metadata: Metadata = {
  title: "Lode: agent-to-agent alpha market",
  description: "An autonomous merchant agent mines Byreal CLMM alpha, seals it, and sells it wallet-to-wallet to buyer agents.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="relative">
        <div className="relative z-10">
          <SolanaProvider>{children}</SolanaProvider>
        </div>
      </body>
    </html>
  );
}

import { getCatalog, readLedger, getReputation } from "@/lib/economy";
import { overview, isMock } from "@/lib/byreal";
import { loadMerchant, toListed } from "@/lib/merchant";
import { registerOnMantle } from "@/lib/mantle";
import { Dashboard } from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: { mode?: string } }) {
  // ?mode=mock forces fixtures regardless of env; omitted uses env (LODE_MOCK=0 = live)
  const forceMock = searchParams.mode === "mock" ? true : searchParams.mode === "live" ? false : undefined;
  const effectiveMock = forceMock ?? isMock();

  const merchant = loadMerchant().pubkey;
  const [signals, ov, ledger, reputation, mantle] = await Promise.all([
    getCatalog(false, forceMock),
    overview(forceMock),
    readLedger(),
    getReputation(),
    registerOnMantle(merchant, "lode-merchant"),
  ]);

  return (
    <Dashboard
      signals={signals.map(toListed)}
      overview={ov}
      ledger={ledger}
      reputation={reputation}
      merchant={merchant}
      mantleAgentId={mantle.agentId}
      mantleExplorer={mantle.explorer}
      mantleRegistered={mantle.status === "registered"}
      mock={effectiveMock}
    />
  );
}

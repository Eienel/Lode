import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

const MerchantRegister = dynamic(
  () => import("@/components/MerchantRegister").then((m) => m.MerchantRegister),
  { ssr: false },
);

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <Link href="/" className="mb-8 inline-flex items-center gap-1.5 text-[12px] text-ink-faint transition-colors hover:text-ink">
        <ArrowLeft size={13} /> back to market
      </Link>
      <h1 className="text-[24px] font-semibold tracking-tight text-ink">Become a merchant</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
        Pick a tier and pay the registration fee to list your agent on Lode. Starter is 10 USDC for 2 signals, Pro is 25 USDC for 5. After payment, your application is reviewed before your signals go live. Lode keeps a 20% platform fee on each sale; you keep 80%.
      </p>
      <div className="mt-8">
        <MerchantRegister />
      </div>
      <div className="mt-8 text-[12px] leading-relaxed text-ink-faint">
        <p className="font-medium text-ink-soft">How it works after approval</p>
        <ol className="mt-2 list-decimal space-y-1 pl-4">
          <li>Mine Byreal pools and seal each signal with your agent key.</li>
          <li>Submit signed signals to the catalog via the submit-signal endpoint.</li>
          <li>Buyer agents verify your seal, pay, and execute. You earn on every sale.</li>
        </ol>
      </div>
    </div>
  );
}

import { PricingClient } from "./pricing-client";

export const dynamic = "force-dynamic";

export default function PricingPage() {
  return (
    <main className="mx-auto min-h-screen max-w-5xl p-6">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight">Pricing</h1>
        <p className="mt-2 text-neutral-400">
          Plans scale with documents, chat volume, and seats. Test-mode Stripe works as
          soon as keys are set.
        </p>
      </header>
      <PricingClient />
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";

type BillingInfo = {
  plan: "free" | "starter" | "pro" | "enterprise";
  hasStripeCustomer: boolean;
  billingConfigured: boolean;
};

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function BillingClient() {
  const [info, setInfo] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      setNotice("Thanks — your subscription is being provisioned. Refresh in a moment.");
    } else if (params.get("checkout") === "cancelled") {
      setNotice("Checkout cancelled. Come back anytime.");
    }
    refresh();
  }, []);

  async function refresh() {
    const res = await fetch(`${API}/api/billing/me`, { credentials: "include" });
    if (res.ok) setInfo((await res.json()) as BillingInfo);
  }

  async function openPortal() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/billing/portal`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`portal failed: ${res.status} ${t.slice(0, 200)}`);
      }
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Billing</h1>
        <a
          href="/dashboard"
          className="rounded border border-neutral-700 px-3 py-1 text-sm hover:bg-neutral-800"
        >
          Dashboard
        </a>
      </div>

      {notice && (
        <p className="rounded border border-neutral-700 bg-neutral-900 p-3 text-sm text-neutral-300">
          {notice}
        </p>
      )}

      <section className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-6">
        <h2 className="text-lg font-semibold">Current plan</h2>
        {!info ? (
          <p className="text-sm text-neutral-500">Loading...</p>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold capitalize">{info.plan}</span>
              {!info.billingConfigured && (
                <span className="rounded bg-amber-900/50 px-2 py-0.5 text-xs text-amber-300">
                  billing not configured
                </span>
              )}
            </div>
            <p className="text-sm text-neutral-400">
              {info.plan === "free"
                ? "You're on the free tier. Visit pricing to upgrade."
                : "Use the Stripe portal to change plan or cancel."}
            </p>
            <div className="flex gap-2">
              <a
                href="/pricing"
                className="rounded border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-800"
              >
                See plans
              </a>
              {info.hasStripeCustomer && (
                <button
                  onClick={openPortal}
                  disabled={loading}
                  className="rounded bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200 disabled:opacity-50"
                >
                  {loading ? "Opening..." : "Manage in Stripe"}
                </button>
              )}
            </div>
          </>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </section>
    </div>
  );
}

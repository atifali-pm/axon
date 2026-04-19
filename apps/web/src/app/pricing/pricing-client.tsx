"use client";

import { useState } from "react";

type Tier = {
  id: "free" | "starter" | "pro";
  name: string;
  price: string;
  blurb: string;
  features: string[];
  cta: string;
};

const TIERS: Tier[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    blurb: "Kick the tires on one small workspace.",
    features: [
      "25 documents",
      "200 chat messages / month",
      "3 members",
      "Groq + Gemini free tiers",
      "Community support",
    ],
    cta: "Current default",
  },
  {
    id: "starter",
    name: "Starter",
    price: "$19 /mo",
    blurb: "For solo founders and small teams shipping their first agent.",
    features: [
      "500 documents",
      "5,000 chat messages / month",
      "10 members",
      "Email support",
      "Stripe billing portal",
    ],
    cta: "Upgrade to Starter",
  },
  {
    id: "pro",
    name: "Pro",
    price: "$99 /mo",
    blurb: "For teams running meaningful volume through Axon.",
    features: [
      "10,000 documents",
      "50,000 chat messages / month",
      "50 members",
      "Priority support",
      "Advanced Langfuse analytics",
    ],
    cta: "Upgrade to Pro",
  },
];

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function PricingClient() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(plan: Tier["id"]) {
    if (plan === "free") return;
    setError(null);
    setLoading(plan);
    try {
      const res = await fetch(`${API}/api/billing/checkout`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (res.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent("/pricing")}`;
        return;
      }
      if (res.status === 503) {
        throw new Error("Billing is not configured yet. Stripe keys needed in .env.");
      }
      if (res.status === 403) {
        throw new Error("Only the org owner can start a checkout.");
      }
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`checkout failed: ${res.status} ${t.slice(0, 200)}`);
      }
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(null);
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {TIERS.map((t) => (
          <div
            key={t.id}
            className="flex flex-col rounded-lg border border-neutral-800 bg-neutral-900 p-6"
          >
            <h2 className="text-lg font-semibold">{t.name}</h2>
            <div className="mt-1 text-3xl font-bold tracking-tight">{t.price}</div>
            <p className="mt-2 text-sm text-neutral-400">{t.blurb}</p>
            <ul className="mt-4 flex-1 space-y-2 text-sm">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => startCheckout(t.id)}
              disabled={t.id === "free" || loading !== null}
              className={
                t.id === "free"
                  ? "mt-6 cursor-default rounded border border-neutral-700 px-4 py-2 text-sm text-neutral-400"
                  : "mt-6 rounded bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200 disabled:opacity-50"
              }
            >
              {loading === t.id ? "Opening Stripe..." : t.cta}
            </button>
          </div>
        ))}
      </div>
      {error && (
        <p className="mt-6 rounded border border-red-800 bg-red-900/30 p-3 text-sm text-red-300">
          {error}
        </p>
      )}
    </>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authClient, signOut } from "@/lib/auth-client";

type Org = { id: string; name: string; slug: string };

export function DashboardClient({
  user,
}: {
  user: { id: string; email: string; name: string | null };
}) {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [newOrgName, setNewOrgName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    const [list, active] = await Promise.all([
      authClient.organization.list(),
      authClient.organization.getFullOrganization(),
    ]);
    setOrgs((list.data ?? []) as Org[]);
    setActiveOrgId((active.data?.id ?? null) as string | null);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const slug = newOrgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const { error } = await authClient.organization.create({
      name: newOrgName,
      slug: `${slug}-${Date.now().toString(36)}`,
    });
    setLoading(false);
    if (error) {
      setError(error.message ?? "failed");
      return;
    }
    setNewOrgName("");
    refresh();
  }

  async function switchOrg(orgId: string) {
    await authClient.organization.setActive({ organizationId: orgId });
    refresh();
  }

  async function onSignOut() {
    await signOut();
    router.push("/login");
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-sm text-neutral-400">
            {user.name ?? user.email} — {user.email}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/documents"
            className="rounded border border-neutral-700 px-3 py-1 text-sm hover:bg-neutral-800"
          >
            Documents
          </a>
          <a
            href="/chat"
            className="rounded border border-neutral-700 px-3 py-1 text-sm hover:bg-neutral-800"
          >
            Chat
          </a>
          <button
            onClick={onSignOut}
            className="rounded border border-neutral-700 px-3 py-1 text-sm hover:bg-neutral-800"
          >
            Sign out
          </button>
        </div>
      </div>

      <section className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900 p-6">
        <h2 className="text-lg font-semibold">Your organizations</h2>
        {orgs.length === 0 ? (
          <p className="text-sm text-neutral-400">No organizations yet. Create one below.</p>
        ) : (
          <ul className="space-y-2">
            {orgs.map((org) => (
              <li
                key={org.id}
                className="flex items-center justify-between rounded border border-neutral-800 px-3 py-2"
              >
                <div>
                  <div className="font-medium">{org.name}</div>
                  <div className="text-xs text-neutral-500">{org.slug}</div>
                </div>
                {org.id === activeOrgId ? (
                  <span className="rounded bg-emerald-900/50 px-2 py-0.5 text-xs text-emerald-300">
                    active
                  </span>
                ) : (
                  <button
                    onClick={() => switchOrg(org.id)}
                    className="rounded border border-neutral-700 px-2 py-0.5 text-xs hover:bg-neutral-800"
                  >
                    switch
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900 p-6">
        <h2 className="text-lg font-semibold">Create organization</h2>
        <form onSubmit={createOrg} className="flex gap-2">
          <input
            required
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
            placeholder="Acme Inc."
            className="flex-1 rounded border border-neutral-700 bg-neutral-950 px-3 py-2 outline-none focus:border-neutral-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200 disabled:opacity-50"
          >
            {loading ? "..." : "Create"}
          </button>
        </form>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </section>
    </div>
  );
}

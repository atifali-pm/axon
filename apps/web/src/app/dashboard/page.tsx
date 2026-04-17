import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { DashboardClient } from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return (
    <main className="mx-auto min-h-screen max-w-3xl p-8">
      <DashboardClient
        user={{
          id: session.user.id,
          email: session.user.email,
          name: session.user.name ?? null,
        }}
      />
    </main>
  );
}

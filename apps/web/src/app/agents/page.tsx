import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AgentsClient } from "./agents-client";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <main className="mx-auto min-h-screen max-w-5xl p-6">
      <AgentsClient />
    </main>
  );
}

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { DocumentsClient } from "./documents-client";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <main className="mx-auto min-h-screen max-w-3xl p-6">
      <DocumentsClient />
    </main>
  );
}

/**
 * scripts/seed-demo.ts
 *
 * Drive the real Axon stack via HTTP to produce a demo-ready dataset:
 *   1. Sign up a fresh user via Better Auth on the web app
 *   2. Create an organization, set it active
 *   3. Create two agent templates (one private, one public for the marketplace)
 *   4. Send a couple of chat messages so the conversation list is non-empty
 *   5. Thumbs-up / thumbs-down a couple of assistant messages
 *   6. Print every URL + credential so a human can pick up where this leaves off
 *
 * Run with the dev stack up:
 *   pnpm tsx scripts/seed-demo.ts
 */
import { setTimeout as sleep } from "node:timers/promises";

const WEB = process.env.WEB_URL ?? "http://localhost:3100";
const API = process.env.API_URL ?? "http://localhost:4000";

const stamp = Math.random().toString(36).slice(2, 8);
const email = `demo+${stamp}@axon.dev`;
const password = "demopass-axon-12345";
const name = "Demo User";
const orgName = `Demo Org ${stamp}`;
const orgSlug = `demo-org-${stamp}`;

type Json = Record<string, unknown>;

async function http(
  method: string,
  url: string,
  body?: Json,
  headers: Record<string, string> = {},
): Promise<{ status: number; data: unknown; setCookie: string[]; bearer?: string }> {
  const res = await fetch(url, {
    method,
    headers: {
      "content-type": "application/json",
      origin: WEB,
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* leave as text */
  }
  const setCookieHeader = res.headers.getSetCookie?.() ?? [];
  const bearer = res.headers.get("set-auth-token") ?? undefined;
  return { status: res.status, data, setCookie: setCookieHeader, bearer };
}

function pickCookieJar(setCookie: string[]): string {
  // We only need the cookie key=value pairs; drop attributes (Path, HttpOnly, ...).
  return setCookie
    .map((c) => c.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

function expect(condition: boolean, label: string, detail?: unknown): void {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    if (detail !== undefined) console.error(JSON.stringify(detail, null, 2));
    process.exit(1);
  }
  console.log(`  ok: ${label}`);
}

(async () => {
  console.log("=== Axon demo seed ===\n");
  console.log(`  email:    ${email}`);
  console.log(`  password: ${password}`);
  console.log(`  org:      ${orgName} (${orgSlug})\n`);

  // 1. Sign up
  console.log("[1] sign up via Better Auth");
  const signup = await http("POST", `${WEB}/api/auth/sign-up/email`, {
    email,
    password,
    name,
  });
  expect(signup.status === 200, "signup returns 200", signup);
  const cookie = pickCookieJar(signup.setCookie);
  expect(cookie.length > 0, "session cookie set");
  const cookieHeader = { cookie };

  // 2. Create org
  console.log("\n[2] create organization");
  const orgRes = await http(
    "POST",
    `${WEB}/api/auth/organization/create`,
    { name: orgName, slug: orgSlug },
    cookieHeader,
  );
  expect(orgRes.status === 200, "create-organization 200", orgRes);
  const org = (orgRes.data as { id?: string }) ?? {};
  expect(typeof org.id === "string", "got organization id", orgRes);
  const orgId = String(org.id);

  // Set active so subsequent calls resolve the org from the session.
  const setActive = await http(
    "POST",
    `${WEB}/api/auth/organization/set-active`,
    { organizationId: orgId },
    cookieHeader,
  );
  expect(setActive.status === 200, "set-active 200", setActive);

  // Better Auth cookie-caches the session for 5 min, so set-active doesn't
  // immediately propagate to /api/me. Override via x-organization-id header
  // (the middleware honours it before falling back to the cached session).
  const apiHeaders = { ...cookieHeader, "x-organization-id": orgId };

  // 3. /api/me
  console.log("\n[3] verify /api/me sees user + org");
  const me = await http("GET", `${API}/api/me`, undefined, apiHeaders);
  expect(me.status === 200, "/api/me 200", me);
  const meData = me.data as { user?: { email?: string }; organization?: { id?: string } };
  expect(meData.user?.email === email, "/api/me echoes email");
  expect(meData.organization?.id === orgId, "/api/me echoes org id");

  // 4. Create agent templates
  console.log("\n[4] create two agent templates");
  const t1 = await http(
    "POST",
    `${API}/api/agents`,
    {
      name: "Support Assistant",
      slug: "support-assistant",
      description: "Polite customer support agent grounded in your docs.",
      systemPrompt:
        "You are a polite customer support agent. Answer using the rag_search tool. Cite sources.",
      allowedTools: ["rag_search"],
      allowedProviders: ["groq", "gemini"],
      samplePrompts: [
        "How do I reset my password?",
        "What is included in the Pro plan?",
      ],
      isPublic: false,
    },
    apiHeaders,
  );
  expect(t1.status === 201, "create private template", t1);

  const t2 = await http(
    "POST",
    `${API}/api/agents`,
    {
      name: "SQL Researcher",
      slug: "sql-researcher",
      description: "Read-only Postgres research assistant. Public template.",
      systemPrompt:
        "You are a read-only Postgres researcher. Use list_tables then query for SELECTs.",
      allowedTools: ["postgres.list_tables", "postgres.query"],
      allowedProviders: ["groq", "openai"],
      samplePrompts: [
        "What tables exist?",
        "How many users signed up this week?",
      ],
      isPublic: true,
    },
    apiHeaders,
  );
  expect(t2.status === 201, "create public template", t2);

  // List + public discovery (both wrap rows in { templates: [...] }).
  const listMine = await http("GET", `${API}/api/agents`, undefined, apiHeaders);
  expect(listMine.status === 200, "list mine 200");
  const mine = (listMine.data as { templates?: unknown[] }).templates ?? [];
  expect(Array.isArray(mine), "list mine returns templates array");
  expect(mine.length === 2, "list mine has 2 entries", listMine);

  const listPublic = await http("GET", `${API}/api/agents/public`);
  expect(listPublic.status === 200, "/api/agents/public 200");
  const pub = (listPublic.data as { templates?: unknown[] }).templates ?? [];
  expect(pub.length >= 1, "public list contains at least 1 entry");

  // 5. Send a chat (non-stream so we don't have to consume SSE)
  console.log("\n[5] send a chat message (non-stream)");
  const chat1 = await http(
    "POST",
    `${API}/api/chat`,
    { message: "Hello! Reply with one short sentence introducing yourself.", stream: false },
    apiHeaders,
  );
  console.log(`     chat status: ${chat1.status}`);
  if (chat1.status >= 400) {
    console.log(`     chat error: ${JSON.stringify(chat1.data).slice(0, 500)}`);
  }
  // Don't hard-fail if the LLM provider has rate limits or quirks; just log.
  const chatOk = chat1.status === 200;
  if (chatOk) {
    const cd = chat1.data as { conversationId?: string };
    console.log(`     conversation: ${cd.conversationId ?? "(missing)"}`);
  }

  // Wait briefly so any async DB writes settle.
  await sleep(500);

  // 6. List conversations
  console.log("\n[6] list conversations");
  const convs = await http("GET", `${API}/api/chat`, undefined, apiHeaders);
  expect(convs.status === 200, "list conversations 200", convs);
  const convList = (convs.data as { conversations?: unknown[] }).conversations ?? [];
  console.log(`     conversations: ${convList.length}`);

  // 7. Wait for the assistant message to land (worker -> agents -> LLM -> DB),
  // then thumbs-up it. Times out after 30s.
  console.log("\n[7] poll for assistant message + rate it");
  let ratedId: string | null = null;
  if (chatOk && convList.length > 0) {
    const conv = convList[0] as { id: string };
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const msgsRes = await http(
        "GET",
        `${API}/api/chat/${conv.id}/messages`,
        undefined,
        apiHeaders,
      );
      const msgs =
        ((msgsRes.data as { messages?: Array<{ id: string; role: string }> }).messages ?? [])
          .filter((m) => m.role === "assistant");
      if (msgs.length > 0) {
        const m = msgs[0]!;
        const fb = await http(
          "POST",
          `${API}/api/chat/messages/${m.id}/feedback`,
          { rating: 1, reason: "demo seed: looks great" },
          apiHeaders,
        );
        if (fb.status === 200 || fb.status === 201) {
          ratedId = m.id;
          console.log(`     rated message ${m.id.slice(0, 8)}: thumbs up`);
        } else {
          console.log(`     feedback returned ${fb.status}: ${JSON.stringify(fb.data)}`);
        }
        break;
      }
      await sleep(1500);
    }
    if (!ratedId) console.log("     no assistant message arrived in 30s; skipping rating");
  }
  const feedback = await http(
    "GET",
    `${API}/api/chat/feedback/export?limit=10`,
    undefined,
    apiHeaders,
  );
  expect(feedback.status === 200, "feedback export 200", feedback);

  // 8. Cross-tenant isolation check: sign up a second user, create a second
  // org, and verify it sees ZERO of the first org's templates.
  console.log("\n[8] cross-tenant isolation check");
  const stamp2 = Math.random().toString(36).slice(2, 8);
  const email2 = `demo+${stamp2}@axon.dev`;
  const orgName2 = `Other Org ${stamp2}`;

  const su2 = await http("POST", `${WEB}/api/auth/sign-up/email`, {
    email: email2,
    password,
    name: "Other Demo",
  });
  expect(su2.status === 200, "second signup 200");
  const cookie2 = pickCookieJar(su2.setCookie);
  const ch2 = { cookie: cookie2 };
  const o2 = await http(
    "POST",
    `${WEB}/api/auth/organization/create`,
    { name: orgName2, slug: `other-${stamp2}` },
    ch2,
  );
  expect(o2.status === 200, "second org create 200");
  const orgId2 = (o2.data as { id?: string }).id!;
  await http(
    "POST",
    `${WEB}/api/auth/organization/set-active`,
    { organizationId: orgId2 },
    ch2,
  );
  const apiHeaders2 = { ...ch2, "x-organization-id": orgId2 };

  const otherList = await http("GET", `${API}/api/agents`, undefined, apiHeaders2);
  expect(otherList.status === 200, "second org list 200");
  const otherMine = (otherList.data as { templates?: unknown[] }).templates ?? [];
  expect(
    otherMine.length === 0,
    "second org sees ZERO of first org's templates (RLS works)",
    otherList,
  );

  // The first org's PRIVATE template id must not be readable from org 2.
  const t1Id = (t1.data as { id: string }).id;
  const probe = await http("GET", `${API}/api/agents/${t1Id}`, undefined, apiHeaders2);
  expect(
    probe.status === 404,
    "second org gets 404 on first org's private template",
    probe,
  );

  console.log("\n=== seed complete ===");
  console.log(`  web:        ${WEB}`);
  console.log(`  api:        ${API}`);
  console.log(`  email:      ${email}`);
  console.log(`  password:   ${password}`);
  console.log(`  org id:     ${orgId}`);
  console.log("  log in at:", `${WEB}/login`);
})().catch((err) => {
  console.error("seed crashed:", err);
  process.exit(1);
});

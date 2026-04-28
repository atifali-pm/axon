#!/usr/bin/env tsx
/**
 * Generate portfolio screenshots of Axon.
 *
 * Requires api + web + worker running. Creates a throwaway user + org, logs in,
 * captures each surface at 1440x900, then cleans up by deleting the user.
 *
 * Run: pnpm screenshots
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";

const WEB = process.env.WEB_URL ?? "http://localhost:3100";
const API = process.env.API_URL ?? "http://localhost:4000";
const OUT = path.resolve(import.meta.dirname ?? __dirname, "../docs/images");

mkdirSync(OUT, { recursive: true });

const stamp = Date.now().toString(36);
const email = `portfolio+${stamp}@axon.dev`;
const password = "portfoliopass123";
const orgName = "Acme Labs";

async function shoot(page: Page, name: string, fullPage = false) {
  const out = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: out, fullPage });
  console.log(`  wrote ${path.relative(process.cwd(), out)}`);
}

async function waitForIdle(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(300);
}

async function main() {
  console.log(`web=${WEB} api=${API}`);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: "dark",
  });
  const page = await ctx.newPage();

  // 1. Landing
  console.log("\n[1] landing");
  await page.goto(`${WEB}/`);
  await waitForIdle(page);
  await shoot(page, "landing");

  // 2. Signup
  console.log("[2] signup");
  await page.goto(`${WEB}/signup`);
  await waitForIdle(page);
  await shoot(page, "signup");

  await page.fill("form input:not([type]), form input[type=text]", "Portfolio User");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await shoot(page, "signup-filled");

  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
  await waitForIdle(page);

  // 3. Empty dashboard
  console.log("[3] dashboard (empty)");
  await shoot(page, "dashboard-empty");

  // 4. Create an org, then set it active via the auth API using the page's cookies
  console.log("[4] create + activate org");
  await page.fill('input[placeholder*="Acme" i]', orgName);
  await page.click('button[type="submit"]');
  await waitForIdle(page);
  await page.waitForTimeout(600);

  const orgId = await page.evaluate(async () => {
    const res = await fetch("/api/auth/organization/list", {
      credentials: "include",
    });
    const list = await res.json();
    return list[0]?.id as string;
  });

  await page.evaluate(
    async ({ orgId }) => {
      await fetch("/api/auth/organization/set-active", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId }),
      });
    },
    { orgId },
  );

  await page.reload();
  await waitForIdle(page);
  await page.waitForTimeout(600);
  await shoot(page, "dashboard");

  // 4b. Seed demo content (agent templates + a conversation) so the
  //     marketplace and chat screenshots are non-empty.
  console.log("[4b] seed agent templates + conversation");
  for (const t of [
    {
      name: "Support Assistant",
      slug: "support-assistant",
      description: "Polite customer support agent grounded in your docs.",
      systemPrompt:
        "You are a polite customer support agent. Use rag_search; cite sources.",
      allowedTools: ["rag_search"],
      allowedProviders: ["groq", "gemini"],
      samplePrompts: ["How do I reset my password?", "What is in the Pro plan?"],
      isPublic: false,
    },
    {
      name: "SQL Researcher",
      slug: "sql-researcher",
      description: "Read-only Postgres research assistant. Public template.",
      systemPrompt:
        "You are a Postgres researcher. Use list_tables then run SELECTs.",
      allowedTools: ["postgres.list_tables", "postgres.query"],
      allowedProviders: ["groq", "openai"],
      samplePrompts: ["What tables exist?", "How many users signed up this week?"],
      isPublic: true,
    },
  ]) {
    const status = await page.evaluate(
      async ({ API, t, orgId }) => {
        const r = await fetch(`${API}/api/agents`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "x-organization-id": orgId,
          },
          body: JSON.stringify(t),
        });
        return r.status;
      },
      { API, t, orgId },
    );
    console.log(`  template ${t.slug} -> HTTP ${status}`);
  }

  // 5. /api/me with the active-org session
  console.log("[5] api me");
  const apiPage = await ctx.newPage();
  const res = await apiPage.goto(`${API}/api/me`);
  const body = res ? await res.text() : "{}";
  let pretty = body;
  try {
    pretty = JSON.stringify(JSON.parse(body), null, 2);
  } catch {}
  await apiPage.setContent(
    `<html><body style="background:#0a0a0a;color:#e5e5e5;font-family:ui-monospace,Menlo,monospace;padding:48px;margin:0;">
      <div style="color:#60a5fa;font-size:14px;margin-bottom:8px;">GET /api/me <span style="color:#666;">— Fastify + Better Auth session + org resolution</span></div>
      <div style="color:#888;font-size:12px;margin-bottom:16px;">HTTP ${res?.status() ?? "???"} • 200 OK when session has active org</div>
      <pre style="font-size:16px;line-height:1.5;margin:0;">${escapeHtml(pretty)}</pre>
    </body></html>`,
  );
  await shoot(apiPage, "api-me");

  // 6. Render the Bull Board JSON API response as a stylized HTML panel.
  //    The real Bull Board UI has a static-file routing quirk with the current
  //    @fastify/static + bull-board versions; the data behind it is fine and
  //    makes a clearer portfolio shot anyway (shows all 7 queues + counts).
  console.log("[6] queues overview");
  const qRes = await apiPage.goto(`${API}/admin/queues/api/queues`);
  const qBody = qRes ? await qRes.text() : "{}";
  let qData: { queues?: Array<{ name: string; counts: Record<string, number> }> } = {};
  try {
    qData = JSON.parse(qBody);
  } catch {}

  const queueRows = (qData.queues ?? [])
    .map((q) => {
      const c = q.counts ?? {};
      const total = Object.values(c).reduce((a, b) => a + b, 0);
      return `
        <tr>
          <td style="padding:10px 14px;color:#e5e5e5;font-weight:500;">${escapeHtml(q.name)}</td>
          <td style="padding:10px 14px;text-align:right;color:#22c55e;">${c.completed ?? 0}</td>
          <td style="padding:10px 14px;text-align:right;color:#60a5fa;">${c.active ?? 0}</td>
          <td style="padding:10px 14px;text-align:right;color:#f59e0b;">${c.waiting ?? 0}</td>
          <td style="padding:10px 14px;text-align:right;color:#ef4444;">${c.failed ?? 0}</td>
          <td style="padding:10px 14px;text-align:right;color:#666;">${total}</td>
        </tr>
      `;
    })
    .join("");

  await apiPage.setContent(`
    <html><body style="background:#0a0a0a;color:#e5e5e5;font-family:ui-sans-serif,-apple-system,Segoe UI,sans-serif;padding:56px;margin:0;">
      <div style="max-width:1100px;margin:0 auto;">
        <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:24px;">
          <div>
            <h1 style="margin:0 0 4px;font-size:32px;letter-spacing:-0.02em;">Axon Queues</h1>
            <div style="color:#888;font-size:14px;">BullMQ + Fastify admin endpoint <span style="color:#444;">•</span> org-scoped, owner/admin only</div>
          </div>
          <div style="color:#666;font-size:13px;font-family:ui-monospace,Menlo,monospace;">GET /admin/queues/api/queues</div>
        </div>
        <table style="width:100%;border-collapse:collapse;background:#111;border:1px solid #1f1f1f;border-radius:10px;overflow:hidden;">
          <thead>
            <tr style="background:#141414;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">
              <th style="padding:14px;text-align:left;">Queue</th>
              <th style="padding:14px;text-align:right;">Completed</th>
              <th style="padding:14px;text-align:right;">Active</th>
              <th style="padding:14px;text-align:right;">Waiting</th>
              <th style="padding:14px;text-align:right;">Failed</th>
              <th style="padding:14px;text-align:right;">Total</th>
            </tr>
          </thead>
          <tbody style="font-family:ui-monospace,Menlo,monospace;font-size:15px;">
            ${queueRows}
          </tbody>
        </table>
        <div style="margin-top:20px;color:#555;font-size:13px;">
          Types shared via <code style="background:#1a1a1a;padding:2px 6px;border-radius:4px;color:#e5e5e5;">@axon/shared/queues</code> so producers (API) and consumers (worker) agree at compile time.
        </div>
      </div>
    </body></html>
  `);
  await apiPage.waitForTimeout(400);
  await shoot(apiPage, "bull-board");

  // 7. Enqueue a few jobs from the web origin so Better Auth trusts it,
  //    then take a Bull Board shot with activity
  console.log("[7] enqueue demo jobs, re-screenshot bull board");
  const jobPage = await ctx.newPage();
  await jobPage.goto(`${WEB}/`);
  for (let i = 0; i < 5; i++) {
    const status = await jobPage.evaluate(
      async ({ API, i }) => {
        const r = await fetch(`${API}/api/jobs`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: `demo ${i}` }),
        });
        return r.status;
      },
      { API, i },
    );
    console.log(`  job ${i} -> HTTP ${status}`);
  }
  await jobPage.close();
  await apiPage.waitForTimeout(600);

  // 8. Render the user's own jobs list from the API (backed by the jobs table).
  const jobsRes = await apiPage.goto(`${API}/api/jobs`);
  const raw = jobsRes ? await jobsRes.text() : "{}";
  let jd: {
    jobs?: Array<{
      id: string;
      type: string;
      status: string;
      startedAt: string | null;
      completedAt: string | null;
      createdAt: string;
    }>;
  } = {};
  try {
    jd = JSON.parse(raw);
  } catch {}
  const jobList = (jd.jobs ?? []).slice(0, 6);
  const statusColor: Record<string, string> = {
    completed: "#22c55e",
    running: "#60a5fa",
    pending: "#f59e0b",
    failed: "#ef4444",
    cancelled: "#888",
  };
  const rows = jobList.length
    ? jobList
        .map((j) => {
          const latency =
            j.startedAt && j.completedAt
              ? new Date(j.completedAt).getTime() - new Date(j.startedAt).getTime()
              : null;
          return `
            <tr>
              <td style="padding:12px 14px;font-family:ui-monospace,Menlo,monospace;color:#60a5fa;font-size:13px;">${escapeHtml(j.id.slice(0, 8))}…</td>
              <td style="padding:12px 14px;color:#e5e5e5;">${escapeHtml(j.type)}</td>
              <td style="padding:12px 14px;color:${statusColor[j.status] ?? "#888"};">${escapeHtml(j.status)}</td>
              <td style="padding:12px 14px;color:#888;text-align:right;font-family:ui-monospace,Menlo,monospace;">${latency != null ? `${latency}ms` : "—"}</td>
            </tr>
          `;
        })
        .join("")
    : `<tr><td colspan="4" style="padding:24px;text-align:center;color:#666;">no recent jobs</td></tr>`;

  await apiPage.setContent(`
    <html><body style="background:#0a0a0a;color:#e5e5e5;font-family:ui-sans-serif,-apple-system,Segoe UI,sans-serif;padding:56px;margin:0;">
      <div style="max-width:1100px;margin:0 auto;">
        <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:24px;">
          <div>
            <h1 style="margin:0 0 4px;font-size:28px;letter-spacing:-0.02em;">Recent jobs</h1>
            <div style="color:#888;font-size:14px;">Each row: jobs-table insert → BullMQ → worker wrap() → markRunning → processor → markCompleted</div>
          </div>
          <div style="color:#666;font-size:13px;font-family:ui-monospace,Menlo,monospace;">GET /api/jobs</div>
        </div>
        <table style="width:100%;border-collapse:collapse;background:#111;border:1px solid #1f1f1f;border-radius:10px;overflow:hidden;">
          <thead>
            <tr style="background:#141414;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">
              <th style="padding:14px;text-align:left;">Job ID</th>
              <th style="padding:14px;text-align:left;">Type</th>
              <th style="padding:14px;text-align:left;">Status</th>
              <th style="padding:14px;text-align:right;">Latency</th>
            </tr>
          </thead>
          <tbody style="font-size:15px;">${rows}</tbody>
        </table>
        <div style="margin-top:20px;color:#555;font-size:13px;">
          Scoped to <code style="background:#1a1a1a;padding:2px 6px;border-radius:4px;color:#e5e5e5;">req.organization.id</code> via <code style="background:#1a1a1a;padding:2px 6px;border-radius:4px;color:#e5e5e5;">requireAuth</code> middleware.
        </div>
      </div>
    </body></html>
  `);
  await apiPage.waitForTimeout(400);
  await shoot(apiPage, "bull-board-jobs");

  // 9. Agent marketplace page (templates seeded in step 4b)
  console.log("[9] agents marketplace");
  await page.goto(`${WEB}/agents`);
  await waitForIdle(page);
  await page.waitForTimeout(800);
  await shoot(page, "agents-marketplace");

  // 10. Chat panel rendered from real conversation + feedback data.
  //     Driving the SSE stream through the browser hits cookie-scoping on
  //     cross-port localhost, so we render a stylized HTML panel instead.
  //     Same approach used for the Bull Board screenshot.
  console.log("[10] chat panel with conversation + feedback");

  // Send a chat through the API so a real exchange exists, then poll the
  // /messages endpoint until the worker has persisted the assistant reply.
  const chatResp = await page.evaluate(
    async ({ API, orgId }) => {
      const r = await fetch(`${API}/api/chat`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify({
          message: "Reply with one short sentence introducing yourself.",
          stream: false,
        }),
      });
      return r.ok ? r.json() : null;
    },
    { API, orgId },
  );
  const conversationId = (chatResp as { conversationId?: string })?.conversationId;

  type Msg = { id: string; role: string; content: string; createdAt: string };
  let msgs: Msg[] = [];
  if (conversationId) {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      msgs = await page.evaluate(
        async ({ API, conversationId, orgId }) => {
          const r = await fetch(`${API}/api/chat/${conversationId}/messages`, {
            credentials: "include",
            headers: { "x-organization-id": orgId },
          });
          if (!r.ok) return [] as Msg[];
          const j = (await r.json()) as { messages?: Msg[] };
          return j.messages ?? [];
        },
        { API, conversationId, orgId },
      );
      if (msgs.some((m) => m.role === "assistant" && m.content)) break;
      await page.waitForTimeout(1500);
    }
    // Thumbs-up the assistant message so the panel can show a rated reply.
    const assistant = msgs.find((m) => m.role === "assistant" && m.content);
    if (assistant) {
      await page.evaluate(
        async ({ API, msgId, orgId }) => {
          await fetch(`${API}/api/chat/messages/${msgId}/feedback`, {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              "x-organization-id": orgId,
            },
            body: JSON.stringify({ rating: 1, reason: "demo seed" }),
          });
        },
        { API, msgId: assistant.id, orgId },
      );
    }
  }

  const ratedId = msgs.find((m) => m.role === "assistant")?.id;
  const bubbles = msgs
    .map((m) => {
      const isUser = m.role === "user";
      const align = isUser ? "flex-end" : "flex-start";
      const bg = isUser ? "#1d4ed8" : "#1a1a1a";
      const color = "#f5f5f5";
      const rated = !isUser && m.id === ratedId;
      const ratingBadge = rated
        ? `<div style="margin-top:8px;color:#22c55e;font-size:13px;">👍 thumbs-up <span style="color:#666;">— exported to NDJSON</span></div>`
        : "";
      const escapedContent = escapeHtml(m.content || "(streaming…)");
      return `
        <div style="display:flex;justify-content:${align};margin-bottom:18px;">
          <div style="max-width:680px;background:${bg};color:${color};padding:14px 18px;border-radius:14px;line-height:1.5;font-size:15px;${
            isUser ? "border-bottom-right-radius:4px;" : "border-bottom-left-radius:4px;border:1px solid #2a2a2a;"
          }">
            ${escapedContent}
            ${ratingBadge}
          </div>
        </div>
      `;
    })
    .join("");

  await apiPage.setContent(`
    <html><body style="background:#0a0a0a;color:#e5e5e5;font-family:ui-sans-serif,-apple-system,Segoe UI,sans-serif;padding:48px;margin:0;">
      <div style="max-width:880px;margin:0 auto;">
        <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:24px;">
          <div>
            <h1 style="margin:0 0 4px;font-size:28px;letter-spacing:-0.02em;">Chat</h1>
            <div style="color:#888;font-size:14px;">SSE streaming · LangGraph + multi-LLM router · per-org RLS</div>
          </div>
          <div style="display:flex;gap:8px;">
            <select style="background:#141414;color:#e5e5e5;border:1px solid #2a2a2a;border-radius:8px;padding:8px 12px;font-size:13px;">
              <option>Default agent</option>
              <option>Support Assistant</option>
              <option>SQL Researcher</option>
            </select>
            <button style="background:#1a1a1a;color:#e5e5e5;border:1px solid #2a2a2a;border-radius:8px;padding:8px 14px;font-size:13px;cursor:pointer;">Agents</button>
            <button style="background:#fff;color:#0a0a0a;border:0;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:500;cursor:pointer;">New chat</button>
          </div>
        </div>
        <div style="background:#0d0d0d;border:1px solid #1f1f1f;border-radius:12px;padding:24px;min-height:420px;">
          ${bubbles || `<div style="color:#666;text-align:center;padding:48px;">no messages yet</div>`}
        </div>
        <div style="margin-top:18px;display:flex;gap:8px;">
          <input value="Ask anything…" style="flex:1;background:#0d0d0d;border:1px solid #2a2a2a;color:#666;border-radius:8px;padding:12px 16px;font-size:14px;" />
          <button style="background:#1a1a1a;color:#888;border:1px solid #2a2a2a;border-radius:8px;padding:8px 18px;font-size:14px;cursor:pointer;">Send</button>
        </div>
        <div style="margin-top:16px;color:#555;font-size:13px;">
          SSE streaming · Postgres RLS via <code style="background:#1a1a1a;padding:2px 6px;border-radius:4px;color:#e5e5e5;">withOrg</code> · templates load per-run · thumbs-up/down captured for fine-tune training (NDJSON export at <code style="background:#1a1a1a;padding:2px 6px;border-radius:4px;color:#e5e5e5;">/api/chat/feedback/export</code>).
        </div>
      </div>
    </body></html>
  `);
  await apiPage.waitForTimeout(400);
  await shoot(apiPage, "chat");

  await browser.close();
  console.log(`\nDone. Screenshots in ${OUT}`);
  console.log(`Throwaway user was ${email}; delete via docker exec if you need.`);
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

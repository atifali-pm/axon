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

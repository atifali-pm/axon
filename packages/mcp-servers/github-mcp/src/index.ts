#!/usr/bin/env node
/**
 * Axon github-mcp
 *
 * An MCP server that exposes a focused, safety-railed slice of the GitHub
 * REST API over stdio. Built on @octokit/rest. Intended to be wired into:
 *   - the Axon agents service via mcp_bridge.py (per-tenant subprocess)
 *   - Claude Desktop, Cursor, or any MCP-aware client
 *
 * Tools:
 *   - list_repos:   list repos for the authenticated user / GITHUB_OWNER
 *   - get_repo:     fetch one repo's metadata
 *   - search_code:  code search, optionally scoped to GITHUB_OWNER
 *   - list_issues:  list issues on a repo
 *   - get_issue:    fetch one issue's body + meta
 *   - create_issue: open a new issue (write; gated by GITHUB_ALLOW_WRITES)
 *
 * Safety rails:
 *   - GITHUB_TOKEN required at startup; validated with a GET /user ping
 *   - GITHUB_OWNER optionally scopes every repo/search lookup to one user/org
 *   - GITHUB_ALLOW_WRITES defaults to false; create_issue rejects unless set
 *   - Result lists capped at MCP_MAX_RESULTS (default 50)
 *   - All errors are returned as `{ isError: true }` so the LLM sees the message
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Octokit } from "@octokit/rest";

const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) {
  console.error("github-mcp: GITHUB_TOKEN is required");
  process.exit(1);
}

const OWNER = process.env.GITHUB_OWNER?.trim() || undefined;
const ALLOW_WRITES = process.env.GITHUB_ALLOW_WRITES === "true";
const MAX_RESULTS = Number(process.env.MCP_MAX_RESULTS ?? 50);

const octokit = new Octokit({ auth: TOKEN, userAgent: "axon-github-mcp/0.0.1" });

const server = new Server(
  { name: "axon-github-mcp", version: "0.0.1" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_repos",
      description:
        "List repositories for the authenticated user or for GITHUB_OWNER if set. Returns up to MCP_MAX_RESULTS entries.",
      inputSchema: {
        type: "object",
        properties: {
          visibility: {
            type: "string",
            enum: ["all", "public", "private"],
            description: "Filter by visibility. Default: all.",
          },
        },
        additionalProperties: false,
      },
    },
    {
      name: "get_repo",
      description: "Fetch a single repository's metadata (description, stars, default branch, topics).",
      inputSchema: {
        type: "object",
        properties: {
          owner: {
            type: "string",
            description: "Repository owner (user or org). Defaults to GITHUB_OWNER if unset.",
          },
          repo: { type: "string", description: "Repository name." },
        },
        required: ["repo"],
        additionalProperties: false,
      },
    },
    {
      name: "search_code",
      description:
        "Search code across GitHub. If GITHUB_OWNER is set, the query is scoped to that user/org via 'user:OWNER'. Returns up to MCP_MAX_RESULTS hits.",
      inputSchema: {
        type: "object",
        properties: {
          q: {
            type: "string",
            description: "Search query in GitHub syntax (e.g. 'withOrg path:apps/api').",
          },
        },
        required: ["q"],
        additionalProperties: false,
      },
    },
    {
      name: "list_issues",
      description: "List issues on a repository. Defaults to open issues.",
      inputSchema: {
        type: "object",
        properties: {
          owner: { type: "string", description: "Repository owner. Defaults to GITHUB_OWNER." },
          repo: { type: "string", description: "Repository name." },
          state: {
            type: "string",
            enum: ["open", "closed", "all"],
            description: "Issue state. Default: open.",
          },
        },
        required: ["repo"],
        additionalProperties: false,
      },
    },
    {
      name: "get_issue",
      description: "Fetch a single issue's title, body, state, labels, and comment count.",
      inputSchema: {
        type: "object",
        properties: {
          owner: { type: "string", description: "Repository owner. Defaults to GITHUB_OWNER." },
          repo: { type: "string", description: "Repository name." },
          issue_number: { type: "number", description: "Issue number." },
        },
        required: ["repo", "issue_number"],
        additionalProperties: false,
      },
    },
    {
      name: "create_issue",
      description:
        "Create a new issue on a repository. WRITE OPERATION: rejected unless GITHUB_ALLOW_WRITES=true.",
      inputSchema: {
        type: "object",
        properties: {
          owner: { type: "string", description: "Repository owner. Defaults to GITHUB_OWNER." },
          repo: { type: "string", description: "Repository name." },
          title: { type: "string", description: "Issue title." },
          body: { type: "string", description: "Issue body in markdown." },
          labels: {
            type: "array",
            items: { type: "string" },
            description: "Labels to apply.",
          },
        },
        required: ["repo", "title"],
        additionalProperties: false,
      },
    },
  ],
}));

function resolveOwner(arg: string | undefined): string {
  const owner = arg?.trim() || OWNER;
  if (!owner) {
    throw new Error("owner is required (set GITHUB_OWNER or pass owner explicitly)");
  }
  return owner;
}

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: rawArgs } = req.params;
  const args = (rawArgs ?? {}) as Record<string, unknown>;

  try {
    if (name === "list_repos") {
      const visibility = (args.visibility as "all" | "public" | "private" | undefined) ?? "all";
      const items = OWNER
        ? (await octokit.repos.listForUser({ username: OWNER, per_page: MAX_RESULTS, type: "owner" })).data
        : (await octokit.repos.listForAuthenticatedUser({ per_page: MAX_RESULTS, visibility, affiliation: "owner" })).data;
      const slim = items.slice(0, MAX_RESULTS).map((r) => ({
        full_name: r.full_name,
        private: r.private,
        description: r.description,
        stars: r.stargazers_count,
        default_branch: r.default_branch,
        updated_at: r.updated_at,
      }));
      return {
        content: [{ type: "text", text: JSON.stringify(slim, null, 2) }],
      };
    }

    if (name === "get_repo") {
      const owner = resolveOwner(args.owner as string | undefined);
      const repo = String(args.repo ?? "");
      if (!repo) throw new Error("repo is required");
      const { data } = await octokit.repos.get({ owner, repo });
      const slim = {
        full_name: data.full_name,
        description: data.description,
        private: data.private,
        stars: data.stargazers_count,
        forks: data.forks_count,
        open_issues: data.open_issues_count,
        default_branch: data.default_branch,
        topics: data.topics,
        homepage: data.homepage,
        license: data.license?.spdx_id ?? null,
        pushed_at: data.pushed_at,
      };
      return { content: [{ type: "text", text: JSON.stringify(slim, null, 2) }] };
    }

    if (name === "search_code") {
      const q = String(args.q ?? "").trim();
      if (!q) throw new Error("q is required");
      const scoped = OWNER && !/\buser:|\borg:|\brepo:/i.test(q) ? `${q} user:${OWNER}` : q;
      const { data } = await octokit.search.code({ q: scoped, per_page: MAX_RESULTS });
      const slim = data.items.slice(0, MAX_RESULTS).map((it) => ({
        repo: it.repository.full_name,
        path: it.path,
        url: it.html_url,
        score: it.score,
      }));
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ total_count: data.total_count, items: slim }, null, 2),
          },
        ],
      };
    }

    if (name === "list_issues") {
      const owner = resolveOwner(args.owner as string | undefined);
      const repo = String(args.repo ?? "");
      if (!repo) throw new Error("repo is required");
      const state = (args.state as "open" | "closed" | "all" | undefined) ?? "open";
      const { data } = await octokit.issues.listForRepo({
        owner,
        repo,
        state,
        per_page: MAX_RESULTS,
      });
      const slim = data
        .filter((i) => !i.pull_request)
        .slice(0, MAX_RESULTS)
        .map((i) => ({
          number: i.number,
          title: i.title,
          state: i.state,
          labels: i.labels.map((l) => (typeof l === "string" ? l : l.name)),
          comments: i.comments,
          updated_at: i.updated_at,
        }));
      return { content: [{ type: "text", text: JSON.stringify(slim, null, 2) }] };
    }

    if (name === "get_issue") {
      const owner = resolveOwner(args.owner as string | undefined);
      const repo = String(args.repo ?? "");
      const issue_number = Number(args.issue_number ?? 0);
      if (!repo || !issue_number) throw new Error("repo and issue_number are required");
      const { data } = await octokit.issues.get({ owner, repo, issue_number });
      const slim = {
        number: data.number,
        title: data.title,
        state: data.state,
        body: data.body,
        labels: data.labels.map((l) => (typeof l === "string" ? l : l.name)),
        comments: data.comments,
        author: data.user?.login,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
      return { content: [{ type: "text", text: JSON.stringify(slim, null, 2) }] };
    }

    if (name === "create_issue") {
      if (!ALLOW_WRITES) {
        throw new Error(
          "create_issue is disabled; set GITHUB_ALLOW_WRITES=true to enable write tools",
        );
      }
      const owner = resolveOwner(args.owner as string | undefined);
      const repo = String(args.repo ?? "");
      const title = String(args.title ?? "");
      if (!repo || !title) throw new Error("repo and title are required");
      const body = typeof args.body === "string" ? args.body : undefined;
      const labels = Array.isArray(args.labels) ? (args.labels as string[]) : undefined;
      const { data } = await octokit.issues.create({ owner, repo, title, body, labels });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { number: data.number, html_url: data.html_url, state: data.state },
              null,
              2,
            ),
          },
        ],
      };
    }

    throw new Error(`unknown tool: ${name}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `error: ${message}` }],
      isError: true,
    };
  }
});

try {
  const { data } = await octokit.users.getAuthenticated();
  console.error(
    `axon-github-mcp: ready (auth=${data.login}, owner=${OWNER ?? "self"}, writes=${ALLOW_WRITES})`,
  );
} catch (err) {
  console.error(
    `axon-github-mcp: token validation failed: ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(1);
}

const transport = new StdioServerTransport();
await server.connect(transport);

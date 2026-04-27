# @axon/github-mcp

A safety-railed GitHub MCP server for Axon. Six tools, stdio transport, write operations off by default.

## What it exposes

| Tool | Description |
|---|---|
| `list_repos` | List repos for the authenticated user (or `GITHUB_OWNER` if set). |
| `get_repo` | Fetch one repo's metadata. |
| `search_code` | Code search; auto-scoped to `GITHUB_OWNER` unless the query already includes `user:` / `org:` / `repo:`. |
| `list_issues` | List issues on a repo (open by default; PRs filtered out). |
| `get_issue` | Fetch one issue's title, body, labels, and comment count. |
| `create_issue` | **Write op.** Open a new issue. Disabled unless `GITHUB_ALLOW_WRITES=true`. |

## Safety model

- `GITHUB_TOKEN` is required at startup and pinged via `GET /user` to fail loud if it's invalid.
- `GITHUB_OWNER` optionally pins every repo/search call to one user or org so a leaked token in a multi-tenant setup can't be used to read across the whole owner space.
- `GITHUB_ALLOW_WRITES` defaults to **false**; `create_issue` rejects with a clear error otherwise.
- Result lists are capped at `MCP_MAX_RESULTS` (default 50) so a runaway agent can't pull a million rows.
- All errors are returned as MCP `{ isError: true }` so the LLM sees the message and can recover or report.

## Running

### Via Claude Desktop

```json
{
  "mcpServers": {
    "axon-github": {
      "command": "node",
      "args": ["/abs/path/to/axon/packages/mcp-servers/github-mcp/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "ghp_...",
        "GITHUB_OWNER": "atifali-pm",
        "GITHUB_ALLOW_WRITES": "false"
      }
    }
  }
}
```

Restart Claude Desktop. You can now ask "list my axon issues" or "search for `withOrg` in my repos".

### Programmatic (from the Axon agents service)

The `agents` service can spawn `axon-github-mcp` per agent run via [apps/agents/src/mcp_bridge.py](../../../apps/agents/src/mcp_bridge.py). The bridge passes through `GITHUB_TOKEN` / `GITHUB_OWNER` / `GITHUB_ALLOW_WRITES` from the agents-service environment so write enablement is a deploy-level decision, not a per-request one.

## Env vars

| Var | Default | Purpose |
|---|---|---|
| `GITHUB_TOKEN` | (required) | PAT or fine-grained token. Validated on startup. |
| `GITHUB_OWNER` | (unset) | If set, every repo / search call is scoped to this user or org. |
| `GITHUB_ALLOW_WRITES` | `false` | Set to `true` to enable `create_issue`. |
| `MCP_MAX_RESULTS` | `50` | Hard cap on list-tool result counts. |

## Building

```bash
pnpm --filter @axon/github-mcp build
```

This compiles to `dist/index.js` and chmods it executable, matching the pattern used by `@axon/postgres-mcp`.

## Extending

This package mirrors the layout of `@axon/postgres-mcp` and `@axon/custom-mcp`. To add more GitHub tools (e.g. `comment_on_issue`, `list_pull_requests`), copy one of the existing tool handlers in `src/index.ts`, add the JSON Schema definition to `ListToolsRequestSchema`, and gate any write operation behind `GITHUB_ALLOW_WRITES`.

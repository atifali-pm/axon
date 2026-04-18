# @axon/postgres-mcp

A read-only Postgres MCP server for Axon. Two tools, stdio transport, safety-rails baked in.

## What it exposes

| Tool | Description |
|---|---|
| `list_tables` | Names of tables in the `public` schema. |
| `query` | One read-only SQL statement (SELECT or WITH). Writes, DDL, and multi-statement queries are rejected. Rows truncated to `MCP_MAX_ROWS` (default 200). |

## Safety model

- Connects as `DATABASE_URL_APP` (the `axon_app` non-superuser role) by default, falling back to `DATABASE_URL`. Runtime RLS applies unless you deliberately connect as the superuser.
- Every query runs inside `BEGIN READ ONLY` so writes fail at the DB layer.
- If `ORG_ID` (UUID) is set, the server issues `SELECT set_config('app.current_org_id', $ORG_ID, true)` at the start of each transaction. Axon's RLS policies resolve tenant access from that GUC.
- First-statement-only: trailing statements are ignored.
- Hard row cap and a 10-second query timeout.

## Running

### Via Claude Desktop

Add to `~/.config/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "axon-postgres": {
      "command": "npx",
      "args": ["-y", "@axon/postgres-mcp"],
      "env": {
        "DATABASE_URL_APP": "postgresql://axon_app:axon_app@localhost:5432/axon"
      }
    }
  }
}
```

Restart Claude Desktop. You can now ask it "what tables are in my axon database?" and it will call `list_tables` through MCP.

### Programmatic (from the Axon agents service)

The `agents` service spawns `axon-postgres-mcp` as a subprocess per agent run with the tenant's `ORG_ID` env, so the agent's queries are fenced by RLS to that tenant's rows.

## Env vars

| Var | Default | Purpose |
|---|---|---|
| `DATABASE_URL_APP` | (none) | Preferred connection URL. Axon's `axon_app` role for RLS enforcement. |
| `DATABASE_URL` | (none) | Fallback URL. Typically the superuser; use only for admin access. |
| `ORG_ID` | (unset) | UUID. If set, scopes queries to this organization via RLS. |
| `MCP_MAX_ROWS` | `200` | Max rows returned per query. |
| `MCP_QUERY_TIMEOUT_MS` | `10000` | Query timeout. |

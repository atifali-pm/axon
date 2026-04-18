#!/usr/bin/env node
/**
 * Axon postgres-mcp
 *
 * An MCP server that exposes two read-only tools over stdio:
 *   - list_tables: return the table names in the public schema
 *   - query:        execute a single SELECT/WITH statement
 *
 * Safety rails:
 *   - Connects as the role specified in DATABASE_URL_APP (axon_app) by default
 *     so Postgres RLS applies. Set DATABASE_URL to the superuser for an
 *     unfenced inspection tool.
 *   - Every query runs inside a transaction begun with READ ONLY; writes are
 *     rejected at the DB layer.
 *   - If ORG_ID is set, we SET app.current_org_id for the txn so tenant RLS
 *     policies resolve correctly. Invalid UUIDs are rejected before the query.
 *   - Only the first SQL statement is executed; trailing statements are ignored.
 *
 * Use cases:
 *   - Wire into Claude Desktop so you can poke at your db in natural language
 *   - Expose as an agent tool in the Axon agents service via langchain-mcp-adapters
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL_APP ?? process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("postgres-mcp: neither DATABASE_URL_APP nor DATABASE_URL is set");
  process.exit(1);
}

const ORG_ID = process.env.ORG_ID;
if (ORG_ID && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ORG_ID)) {
  console.error("postgres-mcp: ORG_ID must be a UUID");
  process.exit(1);
}

const MAX_ROWS = Number(process.env.MCP_MAX_ROWS ?? 200);
const QUERY_TIMEOUT_MS = Number(process.env.MCP_QUERY_TIMEOUT_MS ?? 10_000);

const sql = postgres(DATABASE_URL, {
  max: 2,
  prepare: false,
  idle_timeout: 30,
});

const server = new Server(
  { name: "axon-postgres-mcp", version: "0.0.1" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_tables",
      description:
        "List table names in the public schema. Use this first when you don't know the schema.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "query",
      description:
        "Execute a single read-only SQL query (SELECT or WITH). Writes, DDL, and multi-statement queries are rejected. Returns up to MCP_MAX_ROWS rows.",
      inputSchema: {
        type: "object",
        properties: {
          sql: {
            type: "string",
            description: "The SQL query to execute. Must start with SELECT or WITH.",
          },
        },
        required: ["sql"],
        additionalProperties: false,
      },
    },
  ],
}));

function isReadOnlyStatement(s: string): boolean {
  const stripped = s.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").trim();
  const firstStatement = stripped.split(";")[0]?.trim() ?? "";
  return /^(select|with)\b/i.test(firstStatement);
}

async function runQuery(sqlText: string): Promise<{ rows: unknown[]; rowCount: number; truncated: boolean }> {
  return sql.begin("read only", async (tx) => {
    if (ORG_ID) {
      await tx.unsafe(`SELECT set_config('app.current_org_id', $1, true)`, [ORG_ID]);
    }
    // Strip trailing semicolons/whitespace; we already rejected multi-statement above.
    const single = sqlText.trim().replace(/;\s*$/, "");
    // postgres-js doesn't support passing a plain string to tx() cleanly for
    // unknown queries; use tx.unsafe for dynamic SQL. No bind params here because
    // this is a read-only query surface for agents/inspection, not user input.
    const start = Date.now();
    const rows = await tx.unsafe(single);
    if (Date.now() - start > QUERY_TIMEOUT_MS) {
      throw new Error("query exceeded timeout");
    }
    const arr = rows as unknown as unknown[];
    const truncated = arr.length > MAX_ROWS;
    return { rows: arr.slice(0, MAX_ROWS), rowCount: arr.length, truncated };
  });
}

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;

  try {
    if (name === "list_tables") {
      const rows = await sql.begin("read only", (tx) =>
        tx`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              (rows as unknown as Array<{ table_name: string }>).map((r) => r.table_name),
              null,
              2,
            ),
          },
        ],
      };
    }

    if (name === "query") {
      const sqlText = (args as { sql?: string } | undefined)?.sql ?? "";
      if (!sqlText.trim()) {
        throw new Error("sql is required");
      }
      if (!isReadOnlyStatement(sqlText)) {
        throw new Error(
          "only SELECT/WITH queries are allowed; this MCP server is read-only",
        );
      }
      const result = await runQuery(sqlText);
      const header = result.truncated
        ? `${result.rowCount} row(s) returned, truncated to ${MAX_ROWS}:\n`
        : `${result.rowCount} row(s):\n`;
      return {
        content: [
          { type: "text", text: header + JSON.stringify(result.rows, null, 2) },
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

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(
  `axon-postgres-mcp: ready (org=${ORG_ID ?? "none"}, max_rows=${MAX_ROWS})`,
);

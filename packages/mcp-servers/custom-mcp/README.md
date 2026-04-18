# @axon/custom-mcp

Template for a new MCP server. Two no-op tools (`echo`, `reverse`) so you can verify the wiring before swapping in your own.

## Making a new MCP server

1. Copy this directory to `packages/mcp-servers/<your-name>-mcp`.
2. Rename `package.json`:
   - `"name": "@axon/<your-name>-mcp"`
   - `"bin": { "axon-<your-name>-mcp": "./dist/index.js" }`
3. Edit `src/index.ts`:
   - Replace the tools in `ListToolsRequestSchema` with your real ones.
   - Handle each tool in `CallToolRequestSchema`.
   - Validate env vars at startup (see postgres-mcp for the pattern).
4. Add to `infra/mcp/claude-desktop.json` so Claude Desktop picks it up.
5. Add to `apps/agents/src/mcp_config.py` so the agents service mounts it as a LangChain tool.

## Running

```bash
pnpm --filter @axon/custom-mcp dev
# or build + run
pnpm --filter @axon/custom-mcp build
./packages/mcp-servers/custom-mcp/dist/index.js
```

Stdio protocol: the server reads MCP JSON-RPC requests on stdin and writes responses on stdout. Logs go to stderr.

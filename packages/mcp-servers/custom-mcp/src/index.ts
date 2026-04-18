#!/usr/bin/env node
/**
 * Axon custom-mcp template.
 *
 * Copy this directory to build a new MCP server. Rename the package,
 * replace the example tool, and wire into `infra/mcp/claude-desktop.json`.
 *
 * Two example tools are provided:
 *   - echo:    returns the input message (sanity check)
 *   - reverse: returns the reversed input string (demonstrates arg parsing)
 *
 * Your tools will usually need credentials from env vars; follow the
 * postgres-mcp pattern of validating them at startup and failing loudly.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "axon-custom-mcp", version: "0.0.1" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "echo",
      description: "Return the input message verbatim. Useful as a health check.",
      inputSchema: {
        type: "object",
        properties: {
          message: { type: "string", description: "text to echo" },
        },
        required: ["message"],
        additionalProperties: false,
      },
    },
    {
      name: "reverse",
      description: "Return the reversed string.",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "text to reverse" },
        },
        required: ["text"],
        additionalProperties: false,
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  try {
    if (name === "echo") {
      const message = (args as { message?: string } | undefined)?.message ?? "";
      return { content: [{ type: "text", text: message }] };
    }
    if (name === "reverse") {
      const text = (args as { text?: string } | undefined)?.text ?? "";
      return { content: [{ type: "text", text: text.split("").reverse().join("") }] };
    }
    throw new Error(`unknown tool: ${name}`);
  } catch (err) {
    return {
      content: [{ type: "text", text: `error: ${err instanceof Error ? err.message : String(err)}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("axon-custom-mcp: ready");

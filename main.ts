import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSETransport } from "hono-mcp-server-sse-transport";
import { z } from "zod";
import { promises as fs } from "node:fs";
import path from "node:path";

// 📁 Root directory to search – override with ROOT_DIR env if desired
const ROOT_DIR = Bun.env.ROOT_DIR ?? process.cwd();

// 1️⃣  Minimal MCP server exposing one tool
const mcpServer = new McpServer(
  { name: "file-search-sse", version: "0.1.0" },
  {
    capabilities: {
      tools: {
        find_file_path: {
          name: "find_file_path",
          description:
            "Recursively search the server root for a file by exact name and return all matching absolute paths.",
          inputSchema: z.object({
            filename: z.string().describe('Exact filename, e.g. "library.jar"'),
          }),
          async handler({ filename }: { filename: string }) {
            const hits: string[] = [];
            async function walk(dir: string): Promise<void> {
              for (const entry of await fs.readdir(dir, {
                withFileTypes: true,
              })) {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                  await walk(full);
                } else if (entry.name === filename) {
                  hits.push(full);
                }
              }
            }
            await walk(ROOT_DIR);
            return {
              content:
                hits.length > 0
                  ? hits.map((p) => ({ type: "text", text: p }))
                  : [{ type: "text", text: "NOT_FOUND" }],
            };
          },
        },
      },
    },
  }
);

// 2️⃣  Hono app wrapping the SSE transport
const app = new Hono<{ Variables: { transport?: SSETransport } }>();

// Store active transports
const transports = new Map<string, SSETransport>();

// SSE endpoint – browser / MCP client connects here first
app.get("/sse", (c) =>
  streamSSE(c, async (stream) => {
    const transport = new SSETransport("/messages", stream);
    transports.set(transport.sessionId, transport);
    stream.onAbort(() => {
      transports.delete(transport.sessionId);
    });
    await mcpServer.connect(transport);

    // Heartbeat every minute to keep the connection alive
    while (true) {
      await stream.sleep(60_000);
    }
  })
);

// Secondary endpoint for POSTing tool calls / client messages
app.post("/messages", async (c) => {
  const sessionId = c.req.query("sessionId");
  const transport = sessionId && transports.get(sessionId);
  if (!transport) return c.text("Invalid or expired sessionId", 400);
  return transport.handlePostMessage(c);
});

// 3️⃣  Run on Bun
if (import.meta.main) {
  const startPort = Number(Bun.env.PORT ?? 58839);
  const maxRetries = 10;

  async function tryServe(port: number, attempt: number = 0): Promise<void> {
    try {
      Bun.serve({ port, fetch: app.fetch });
      console.log(`🚀 MCP SSE server listening on http://localhost:${port}`);
    } catch (error) {
      if (attempt < maxRetries) {
        const nextPort = port + 1;
        console.log(`Port ${port} is in use, trying port ${nextPort}...`);
        await tryServe(nextPort, attempt + 1);
      } else {
        console.error(`Failed to start server after ${maxRetries} attempts.`);
        throw error;
      }
    }
  }

  tryServe(startPort);
}

// 4️⃣  Export fetch handler for edge / runner compatibility
export default app.fetch;

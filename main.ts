#!/usr/bin/env bun

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type JSONRPCMessage,
} from "@modelcontextprotocol/sdk/types.js";
import type { CallToolRequest } from "@modelcontextprotocol/sdk/types.js";
import { Glob } from "bun";

const server = new Server(
  {
    name: "find-library-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "find_file",
        description:
          "Find the first occurrence of a file by name in the current directory tree",
        inputSchema: {
          type: "object",
          properties: {
            filename: {
              type: "string",
              description: "The name of the file to search for",
            },
          },
          required: ["filename"],
        },
      },
    ],
  };
});

server.setRequestHandler(
  CallToolRequestSchema,
  async (request: CallToolRequest) => {
    if (request.params.name === "find_file") {
      const { filename } = request.params.arguments as { filename: string };

      if (!filename) {
        throw new Error("Missing 'filename' parameter");
      }

      const glob = new Glob(`**/${filename}`);
      let found: string | null = null;

      for await (const path of glob.scan(process.cwd())) {
        found = path;
        break;
      }

      return {
        content: [
          {
            type: "text",
            text: found ? `Found: ${found}` : `File '${filename}' not found`,
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${request.params.name}`);
  }
);

class BunHTTPTransport {
  private responseQueue: JSONRPCMessage[] = [];

  async start() {}

  async close() {}

  async send(message: JSONRPCMessage) {
    this.responseQueue.push(message);
  }

  async handleRequest(message: JSONRPCMessage): Promise<JSONRPCMessage | null> {
    this.responseQueue = [];

    return new Promise<JSONRPCMessage | null>((resolve) => {
      if (this.onmessage) {
        Promise.resolve(this.onmessage(message)).then(() => {
          setTimeout(() => {
            resolve(
              this.responseQueue.length > 0 ? this.responseQueue[0]! : null
            );
          }, 50);
        });
      } else {
        resolve(null);
      }
    });
  }

  onmessage?: (message: JSONRPCMessage) => void | Promise<void>;
  onclose?: () => void;
  onerror?: (error: Error) => void;
}

const transport = new BunHTTPTransport();
await server.connect(transport);

const httpServer = Bun.serve({
  port: 58840,
  async fetch(req) {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      const message = (await req.json()) as JSONRPCMessage;
      const response = await transport.handleRequest(message);

      if (response) {
        return new Response(JSON.stringify(response), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
      }

      return new Response(null, { status: 204 });
    } catch (error) {
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32700,
            message: "Parse error",
          },
          id: null,
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }
  },
});

console.error(`Find Library MCP server running on port ${httpServer.port}`);

#!/usr/bin/env bun

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
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

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Find Library MCP server running on stdio");

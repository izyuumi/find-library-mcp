import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { walk } from "https://deno.land/std@0.209.0/fs/walk.ts";

const server = new Server(
  {
    name: "find-library-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

async function findJarFile(
  filename: string,
  directory: string = Deno.cwd()
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    const foundPaths: string[] = [];

    for await (const entry of walk(directory, {
      exts: [".jar"],
      match: [new RegExp(`${filename}$`)],
    })) {
      foundPaths.push(entry.path);
    }

    if (foundPaths.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No jar file named "${filename}" found in ${directory}`,
          },
        ],
      };
    }

    if (foundPaths.length === 1) {
      return {
        content: [
          {
            type: "text",
            text: foundPaths[0],
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: foundPaths.join("\n"),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error searching for jar file: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
    };
  }
}

server.setRequestHandler(ListToolsRequestSchema, () => {
  return {
    tools: [
      {
        name: "find-jar",
        description:
          "Find a jar file by name in a directory and return its full path",
        inputSchema: {
          type: "object",
          properties: {
            filename: {
              type: "string",
              description: "The name of the jar file to find (e.g., 'xxx.jar')",
            },
            directory: {
              type: "string",
              description:
                "The directory to search in (defaults to current directory)",
            },
          },
          required: ["filename"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "find-jar": {
      const { filename, directory } = args as {
        filename: string;
        directory?: string;
      };
      return await findJarFile(filename, directory);
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);

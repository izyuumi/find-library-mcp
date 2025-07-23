import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import cors from "cors";

const server = new McpServer({
  name: "find-library-mcp",
  version: "1.0.0",
});

async function findFile(
  filename: string,
  searchPath: string
): Promise<string | null> {
  try {
    const entries = await readdir(searchPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(searchPath, entry.name);

      if (entry.isFile() && entry.name === filename) {
        return resolve(fullPath);
      }

      if (entry.isDirectory()) {
        const result = await findFile(filename, fullPath);
        if (result) return result;
      }
    }
  } catch (error) {
    console.error(`Error searching in ${searchPath}:`, error);
  }

  return null;
}

server.tool("find_file", { filename: z.string() }, async ({ filename }) => {
  const searchDirectory = process.cwd();
  console.log(`Searching for "${filename}" in ${searchDirectory}`);

  const filePath = await findFile(filename, searchDirectory);

  if (filePath) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              found: true,
              filename,
              path: filePath,
              searchDirectory,
            },
            null,
            2
          ),
        },
      ],
    };
  } else {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              found: false,
              filename,
              message: `File "${filename}" not found in ${searchDirectory}`,
              searchDirectory,
            },
            null,
            2
          ),
        },
      ],
    };
  }
});

const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    credentials: false,
  })
);

app.get("/", (req, res) => {
  res.json({
    name: "Find Library MCP Server",
    version: "1.0.0",
    status: "running",
    endpoints: {
      "/": "Server information (this response)",
      "/sse": "Server-Sent Events endpoint for MCP connection",
      "/messages": "POST endpoint for MCP messages",
    },
    tools: [
      {
        name: "find_file",
        description:
          "Find a file by name in the current directory and subdirectories",
        parameters: {
          filename: "The name of the file to search for (e.g., 'library.jar')",
        },
      },
    ],
  });
});

let transport: SSEServerTransport;

app.get("/sse", async (req, res) => {
  transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  await transport.handlePostMessage(req, res);
});

async function findAvailablePort(startPort: number): Promise<number> {
  let port = startPort;

  while (true) {
    try {
      await new Promise<void>((resolve, reject) => {
        const testServer = app
          .listen(port, () => {
            testServer.close(() => resolve());
          })
          .on("error", (err: any) => {
            if (err.code === "EADDRINUSE") {
              reject(err);
            } else {
              reject(err);
            }
          });
      });
      return port;
    } catch (err: any) {
      if (err.code === "EADDRINUSE") {
        console.log(`Port ${port} is in use, trying ${port + 1}...`);
        port++;
      } else {
        throw err;
      }
    }
  }
}

(async () => {
  const START_PORT = process.env.PORT ? parseInt(process.env.PORT) : 58840;
  const PORT = await findAvailablePort(START_PORT);

  app.listen(PORT, () => {
    console.log(`Find Library MCP Server running on port ${PORT}`);
  });
})();

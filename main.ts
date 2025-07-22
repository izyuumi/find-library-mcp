import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  InitializeRequestSchema,
  JSONRPCError,
  JSONRPCNotification,
} from "@modelcontextprotocol/sdk/types.js";
import { walk } from "https://deno.land/std@0.209.0/fs/walk.ts";

const SESSION_ID_HEADER_NAME = "mcp-session-id";

class MCPServerManager {
  private server: Server;
  private transports: { [sessionId: string]: StreamableHTTPServerTransport } =
    {};

  constructor() {
    this.server = new Server(
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

    this.setupTools();
  }

  private setupTools() {
    this.server.setRequestHandler(ListToolsRequestSchema, () => {
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
                  description:
                    "The name of the jar file to find (e.g., 'xxx.jar')",
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

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "find-jar": {
          const { filename, directory } = args as {
            filename: string;
            directory?: string;
          };
          return await this.findJarFile(filename, directory);
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  private async findJarFile(
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

  async handleGetRequest(request: Request): Promise<Response> {
    const sessionId = request.headers.get(SESSION_ID_HEADER_NAME);

    if (!sessionId || !this.transports[sessionId]) {
      return new Response(
        JSON.stringify(
          this.createErrorResponse("Bad Request: invalid session ID")
        ),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Establishing SSE stream for session ${sessionId}`);
    const transport = this.transports[sessionId];

    return await this.handleTransportRequest(transport, request);
  }

  async handlePostRequest(request: Request): Promise<Response> {
    try {
      const sessionId = request.headers.get(SESSION_ID_HEADER_NAME);
      let body;

      try {
        body = await request.json();
      } catch (jsonError) {
        console.error("Failed to parse JSON body:", jsonError);
        return new Response(
          JSON.stringify(
            this.createErrorResponse("Invalid JSON in request body")
          ),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      console.log("POST request received:");
      console.log("  Session ID:", sessionId || "none");
      console.log("  Body:", JSON.stringify(body, null, 2));

      if (sessionId && this.transports[sessionId]) {
        console.log("Using existing transport for session:", sessionId);
        const transport = this.transports[sessionId];
        return await this.handleTransportRequest(transport, request, body);
      }

      if (!sessionId && this.isInitializeRequest(body)) {
        console.log("Creating new transport for initialize request");
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => crypto.randomUUID(),
        });

        await this.server.connect(transport);
        const response = await this.handleTransportRequest(
          transport,
          request,
          body
        );

        const newSessionId = transport.sessionId;
        if (newSessionId) {
          this.transports[newSessionId] = transport;
          console.log("Created new session:", newSessionId);
        }

        return response;
      }

      console.log("Invalid request - no session ID or not initialize request");
      return new Response(
        JSON.stringify(
          this.createErrorResponse("Bad Request: invalid session ID or method")
        ),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Error handling MCP POST request:", error);
      console.error(
        "Stack trace:",
        error instanceof Error ? error.stack : "No stack trace"
      );
      return new Response(
        JSON.stringify(
          this.createErrorResponse(
            `Internal server error: ${
              error instanceof Error ? error.message : String(error)
            }`
          )
        ),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  private async handleTransportRequest(
    transport: StreamableHTTPServerTransport,
    request: Request,
    body?: any
  ): Promise<Response> {
    const url = new URL(request.url);

    const mockReq = {
      method: request.method,
      url: request.url,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams.entries()),
      headers: Object.fromEntries(request.headers.entries()),
      body: body,
      get: (name: string) => request.headers.get(name),
    };

    let responseData: any = "";
    let statusCode = 200;
    let headers: Record<string, string> = {};
    let isSSE = false;

    const mockRes = {
      statusCode,
      status: (code: number) => {
        statusCode = code;
        mockRes.statusCode = code;
        return mockRes;
      },
      set: (name: string, value: string) => {
        headers[name] = value;
        if (
          name.toLowerCase() === "content-type" &&
          value.includes("text/event-stream")
        ) {
          isSSE = true;
        }
        return mockRes;
      },
      json: (data: any) => {
        responseData = JSON.stringify(data);
        headers["Content-Type"] = "application/json";
        return mockRes;
      },
      send: (data: any) => {
        responseData = typeof data === "string" ? data : JSON.stringify(data);
        return mockRes;
      },
      writeHead: (code: number, headerObj?: Record<string, string>) => {
        statusCode = code;
        mockRes.statusCode = code;
        if (headerObj) {
          Object.assign(headers, headerObj);
          if (headerObj["Content-Type"]?.includes("text/event-stream")) {
            isSSE = true;
          }
        }
      },
      write: (chunk: any, encoding?: string, callback?: () => void) => {
        if (typeof chunk === "string") {
          responseData += chunk;
        } else if (chunk instanceof Uint8Array) {
          responseData += new TextDecoder().decode(chunk);
        } else {
          responseData += String(chunk);
        }
        if (callback) callback();
        return true;
      },
      end: (
        chunk?: any,
        encoding?: string | (() => void),
        callback?: () => void
      ) => {
        if (chunk) {
          if (typeof chunk === "string") {
            responseData += chunk;
          } else if (chunk instanceof Uint8Array) {
            responseData += new TextDecoder().decode(chunk);
          } else {
            responseData += String(chunk);
          }
        }
        if (typeof encoding === "function") {
          encoding();
        } else if (callback && typeof callback === "function") {
          callback();
        }
      },
      setHeader: (name: string, value: string | string[]) => {
        headers[name] = Array.isArray(value) ? value.join(", ") : value;
        if (
          name.toLowerCase() === "content-type" &&
          String(value).includes("text/event-stream")
        ) {
          isSSE = true;
        }
      },
      getHeader: (name: string) => headers[name],
      getHeaders: () => headers,
      removeHeader: (name: string) => {
        delete headers[name];
      },
      headersSent: false,
      finished: false,
      writableEnded: false,
      writableFinished: false,
      on: (event: string, listener: () => void) => mockRes,
      once: (event: string, listener: () => void) => mockRes,
      emit: (event: string, ...args: any[]) => false,
      addListener: (event: string, listener: () => void) => mockRes,
      removeListener: (event: string, listener: () => void) => mockRes,
      off: (event: string, listener: () => void) => mockRes,
      prependListener: (event: string, listener: () => void) => mockRes,
      prependOnceListener: (event: string, listener: () => void) => mockRes,
    };

    try {
      await transport.handleRequest(mockReq as any, mockRes as any, body);

      return new Response(responseData, {
        status: statusCode,
        headers: new Headers(headers),
      });
    } catch (error) {
      console.error("Error in handleTransportRequest:", error);
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: `Internal error: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
          id: null,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  private createErrorResponse(message: string): JSONRPCError {
    return {
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: message,
      },
      id: crypto.randomUUID(),
    };
  }

  private isInitializeRequest(body: any): boolean {
    const isInitial = (data: any) => {
      const result = InitializeRequestSchema.safeParse(data);
      return result.success;
    };
    if (Array.isArray(body)) {
      return body.some((request) => isInitial(request));
    }
    return isInitial(body);
  }
}

const mcpServer = new MCPServerManager();

const handler = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);

  if (url.pathname === "/mcp") {
    if (request.method === "GET") {
      return await mcpServer.handleGetRequest(request);
    } else if (request.method === "POST") {
      return await mcpServer.handlePostRequest(request);
    }
  }

  return new Response("Not Found", { status: 404 });
};

const port = 58839;
console.log(`MCP Streamable HTTP Server listening on port ${port}`);
console.log(`Connect clients to: http://localhost:${port}/mcp`);

Deno.serve({ port }, handler);

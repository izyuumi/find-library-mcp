import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

async function testServer() {
  const client = new Client({
    name: "test-client",
    version: "1.0.0",
  });

  try {
    console.log("Connecting to MCP server...");
    const transport = new StreamableHTTPClientTransport(
      new URL("http://localhost:58839/mcp")
    );

    await client.connect(transport);
    console.log("✅ Connected successfully!");

    console.log("\nListing available tools...");
    const tools = await client.listTools();
    console.log(
      "Available tools:",
      tools.tools.map((t) => t.name)
    );

    console.log("\nTesting find-jar tool...");
    const result = await client.callTool({
      name: "find-jar",
      arguments: {
        filename: "test.jar",
        directory: ".",
      },
    });

    console.log("Tool result:", result.content);

    await client.close();
    console.log("✅ Test completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

if (import.meta.main) {
  await testServer();
}

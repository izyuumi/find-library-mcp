# find-library-mcp

MCP server for finding jar files in local directories. Uses HTTP transport with Server-Sent Events (SSE) for real-time communication.

## Setup

```bash
deno install
```

## Configuration

Copy [`example.mcp.json`](example.mcp.json) to your MCP configuration directory. The server runs on HTTP transport:

```json
{
  "mcpServers": {
    "find-library-mcp": {
      "url": "http://localhost:58839/mcp"
    }
  }
}
```

## Usage

Start the server:

```bash
deno run --allow-read --allow-env --allow-net main.ts
```

Or use the dev task:

```bash
deno task dev
```

The server will start on `http://localhost:58839/mcp` and accept MCP client connections.

## Features

- Find jar files by name in any directory
- Searches recursively through subdirectories
- Returns full path to the jar file
- Defaults to searching in current directory if no directory specified
- Returns all matching jar files if multiple found
- HTTP transport with Server-Sent Events support
- Session management for multiple simultaneous connections

## Tool Usage

The server provides a single tool:

### `find-jar`

Finds a jar file by name and returns its full path.

**Parameters:**

- `filename` (required): The name of the jar file to find (e.g., "xxx.jar")
- `directory` (optional): The directory to search in (defaults to current directory)

**Examples:**

- Find "commons-lang3.jar" in current directory
- Find "spring-core.jar" in "/usr/local/lib"
- Find any jar file with specific name pattern

## Transport

This server uses **Streamable HTTP** transport, which supports:

- HTTP POST requests for client-to-server communication
- Server-Sent Events (SSE) for server-to-client streaming
- Session management for multiple concurrent connections
- Both basic request-response and streaming communication patterns

## License

MIT

# Find Library MCP Server

A minimal MCP (Model Context Protocol) server that finds files in the current directory tree.

## Features

- **find_file** tool: Searches recursively for a file by name starting from the current working directory
- Returns the first matching file path found
- Built with Bun runtime for fast performance

## Installation

```bash
bun install
```

## Usage

### Running the server

```bash
bun main.ts
```

### Using with Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "find-library": {
      "command": "bun",
      "args": ["/path/to/find-library-mcp/main.ts"]
    }
  }
}
```

### Tool: find_file

The server provides a single tool called `find_file` that accepts:

- `filename` (string, required): The name of the file to search for

Example usage in Claude:

- "Use find_file to locate library.jar"
- "Find the file named config.json"

The tool returns the first matching file path found, or indicates if the file was not found.

## Development

Built with:

- Bun runtime
- @modelcontextprotocol/sdk
- TypeScript

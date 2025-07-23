# Find Library MCP Server

An MCP (Model Context Protocol) SSE server that searches for files in the current directory and subdirectories.

## Features

- **File Search**: Search for any file by name in the current directory and all subdirectories
- **SSE Support**: Server-Sent Events for real-time communication
- **CORS Enabled**: Accessible from any origin

## Installation

```bash
bun install
```

## Usage

Start the server:

```bash
bun run start
```

The server will run on port 58840 by default. If that port is in use, it will automatically increment to find an available port. You can also specify a custom port using the `PORT` environment variable.

## Endpoints

- `GET /` - Server information and available tools
- `GET /sse` - Server-Sent Events endpoint for MCP connection
- `POST /messages` - Message handling endpoint for MCP

## Tools

### find_file

Searches for a file by name in the current directory and all subdirectories.

**Parameters:**

- `filename` (string): The name of the file to search for (e.g., 'library.jar')

**Returns:**

- If found: The full path to the file
- If not found: An error message

## Example

To search for a file named `library.jar`:

```json
{
  "tool": "find_file",
  "parameters": {
    "filename": "library.jar"
  }
}
```

## Response Format

### File Found

```json
{
  "found": true,
  "filename": "library.jar",
  "path": "/Users/username/Downloads/find-library-mcp/library.jar",
  "searchDirectory": "/Users/username/Downloads/find-library-mcp"
}
```

### File Not Found

```json
{
  "found": false,
  "filename": "library.jar",
  "message": "File \"library.jar\" not found in /Users/username/Downloads/find-library-mcp",
  "searchDirectory": "/Users/username/Downloads/find-library-mcp"
}
```

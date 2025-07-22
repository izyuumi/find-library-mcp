# find-library-mcp

MCP server for finding jar files in local directories.

## Setup

```bash
deno install
```

## Configuration

Copy [`example.mcp.json`](example.mcp.json) to your MCP configuration directory and adjust paths.

## Usage

```bash
deno run --allow-read --allow-env main.ts
```

## Features

- Find jar files by name in any directory
- Searches recursively through subdirectories
- Returns full path to the jar file
- Defaults to searching in current directory if no directory specified
- Returns all matching jar files if multiple found

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

## License

MIT

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";


// Initialize MCP server
export const mcpServer = new McpServer({
  name: "flight-agent-mcp",
  version: "1.0.0",
});

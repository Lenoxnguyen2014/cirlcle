import express, { type Request, type Response } from "express";
import cors from "cors";
import "dotenv/config";
import { randomUUID } from "node:crypto";
import router from "./routes/routes.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { mcpServer } from "./config/mcp.js";
import { registerFlightTools } from "./tools/flightTools.js";

const app = express();
app.use(cors());
app.use(express.json());

registerFlightTools();

// Map to manage active MCP client transport sessions
const mcpTransports: Record<string, StreamableHTTPServerTransport> = {};

// Single Streamable HTTP endpoint: handles session init (GET/POST) and
// subsequent tool-call requests, keyed by the "mcp-session-id" header.
app.all("/mcp", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  let transport = sessionId ? mcpTransports[sessionId] : undefined;

  if (!transport) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => {
        mcpTransports[sid] = transport!;
      },
    });

    transport.onclose = () => {
      if (transport!.sessionId) {
        delete mcpTransports[transport!.sessionId];
      }
    };

    await mcpServer.connect(transport);
  }

  await transport.handleRequest(req, res, req.body);
});

app.get("/", (req, res) => {
  res.json({
    status: "online",
    message: "Flight Agent Backend API is active!",
    endpoints: [
      "/api/wallet/status",
      "/api/flights/search",
      "/api/monitor/tasks",
      "/api/agent/run",
      '/mcp'
    ],
  });
});
app.use("/api", router);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✈️ Server running on http://localhost:${PORT}`);
});

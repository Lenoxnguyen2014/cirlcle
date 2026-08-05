# Flight Agent — Chat Frontend

React + Vite + TypeScript chat UI that talks to the backend's MCP agent endpoint (`POST /api/mcp/run`).

## Running

```bash
# terminal 1
cd backend && npm install && npm run dev   # http://localhost:3000

# terminal 2
cd frontend && npm install && npm run dev  # http://localhost:5173
```

Optionally copy `.env.example` to `.env` to override the backend URL (defaults to `http://localhost:3000`):

```bash
cp .env.example .env
```

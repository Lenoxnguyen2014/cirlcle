import type { ChatMessage, McpRunResponseData } from '../types/chat';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export async function runMcpChat(messages: ChatMessage[]): Promise<McpRunResponseData> {
  const payload = messages
    .filter((m) => m.role !== 'error')
    .map((m) => ({ role: m.role, content: m.content }));

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/mcp/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: payload }),
    });
  } catch {
    throw new Error('Network error: unable to reach the agent backend');
  }

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(body.error ?? body.details ?? `Request failed with status ${res.status}`);
  }

  return body.data as McpRunResponseData;
}

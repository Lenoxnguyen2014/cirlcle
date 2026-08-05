import { z } from 'zod';
import { mcpServer } from '../config/mcp.js';
import { chatWithTools } from './llmClient.js';

type IncomingRole = 'user' | 'assistant';

interface IncomingMessage {
  role: IncomingRole;
  content:
    | string
    | { type: 'text_response'; text: string }
    | { type: 'tool_execution'; toolCalled: string; arguments: unknown; result: unknown };
}

function serializeContent(content: IncomingMessage['content']): string {
  if (typeof content === 'string') return content;
  if (content.type === 'text_response') return content.text;
  return `Called tool "${content.toolCalled}" with args ${JSON.stringify(content.arguments)}. Result: ${JSON.stringify(content.result)}`;
}

export async function runAgentLoop(messages: IncomingMessage[]) {
  // 1. Get available tool definitions from McpServer
  const registeredTools =
    (mcpServer as unknown as { _registeredTools?: Record<string, any> })._registeredTools || {};

  // 2. Format MCP tools into provider-agnostic declarations.
  // tool.inputSchema is a raw Zod schema — convert it to standard JSON Schema.
  const tools = Object.entries(registeredTools).map(([name, tool]) => ({
    name,
    description: tool.description,
    parametersJsonSchema: z.toJSONSchema(tool.inputSchema),
  }));

  const turns = messages.map((msg) => ({
    role: msg.role,
    text: serializeContent(msg.content),
  }));

  // 3. Ask the configured LLM provider (Gemini or DeepSeek) with tools attached
  const result = await chatWithTools(turns, tools);

  // 4. Check if the LLM wants to invoke an MCP tool
  if (result.type === 'tool_call') {
    const toolHandler = registeredTools[result.name]?.handler;
    if (!toolHandler) {
      throw new Error(`Tool ${result.name} not found on MCP Server.`);
    }

    const toolResult = await toolHandler(result.args, {});

    return {
      type: 'tool_execution',
      toolCalled: result.name,
      arguments: result.args,
      result: toolResult,
    };
  }

  // 5. If no tool was requested, return text response
  return {
    type: 'text_response',
    text: result.text,
  };
}

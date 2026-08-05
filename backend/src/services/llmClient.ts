import { gemini, deepseek } from '../config/ai.js';

type LlmProvider = 'gemini' | 'deepseek';

// Local dev defaults to DeepSeek (cheap, no free-tier quota cliffs); production
// defaults to Gemini. Override explicitly with AI_PROVIDER if needed.
const provider: LlmProvider =
  (process.env.AI_PROVIDER as LlmProvider | undefined) ||
  (process.env.NODE_ENV === 'production' ? 'gemini' : 'deepseek');

interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

interface ToolDeclaration {
  name: string;
  description?: string;
  parametersJsonSchema: unknown;
}

export type LlmResult =
  | { type: 'tool_call'; name: string; args: Record<string, unknown> }
  | { type: 'text'; text: string };

export async function chatWithTools(turns: ChatTurn[], tools: ToolDeclaration[]): Promise<LlmResult> {
  return provider === 'gemini' ? chatWithGemini(turns, tools) : chatWithDeepSeek(turns, tools);
}

// Gemini expects roughly alternating user/model turns; merge consecutive
// same-role turns (e.g. after a client-side error turn was filtered out)
// into one turn's parts instead of starting a new one.
async function chatWithGemini(turns: ChatTurn[], tools: ToolDeclaration[]): Promise<LlmResult> {
  const contents: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
  for (const turn of turns) {
    const role: 'user' | 'model' = turn.role === 'user' ? 'user' : 'model';
    const last = contents[contents.length - 1];
    if (last && last.role === role) {
      last.parts.push({ text: turn.text });
    } else {
      contents.push({ role, parts: [{ text: turn.text }] });
    }
  }

  const functionDeclarations = tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parametersJsonSchema: tool.parametersJsonSchema,
  }));

  const response = await gemini.models.generateContent({
    model: 'gemini-flash-latest',
    contents,
    config: { tools: [{ functionDeclarations }] },
  });

  const call = response.functionCalls?.[0];
  if (call?.name) {
    return { type: 'tool_call', name: call.name, args: (call.args ?? {}) as Record<string, unknown> };
  }
  return { type: 'text', text: response.text ?? '' };
}

async function chatWithDeepSeek(turns: ChatTurn[], tools: ToolDeclaration[]): Promise<LlmResult> {
  const messages = turns.map((turn) => ({ role: turn.role, content: turn.text }));

  const openAiTools = tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parametersJsonSchema,
    },
  }));

  const response = await deepseek.chat.completions.create({
    model: 'deepseek-chat',
    messages,
    tools: openAiTools,
  });

  const message = response.choices[0]?.message;
  const toolCall = message?.tool_calls?.[0];

  if (toolCall && toolCall.type === 'function') {
    return {
      type: 'tool_call',
      name: toolCall.function.name,
      args: JSON.parse(toolCall.function.arguments || '{}'),
    };
  }
  return { type: 'text', text: message?.content ?? '' };
}

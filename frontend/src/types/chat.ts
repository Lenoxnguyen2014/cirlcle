export interface Flight {
  id: string;
  airline: string;
  flightNo: string;
  origin: string;
  destination: string;
  priceUsdc: string;
  currency: string;
  departureTime?: string;
  arrivalTime?: string;
}

export interface ToolExecutionResult {
  type: 'tool_execution';
  toolCalled: string;
  arguments: Record<string, unknown>;
  result: unknown;
}

export interface TextResponseResult {
  type: 'text_response';
  text: string;
}

export type McpRunResponseData = ToolExecutionResult | TextResponseResult;

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string | McpRunResponseData;
  timestamp: number;
}

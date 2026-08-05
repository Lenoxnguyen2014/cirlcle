import type { ChatMessage, Flight } from '../types/chat';
import { MessageBubble } from './MessageBubble';
import { ToolCallCard } from './ToolCallCard';
import { FlightList } from './FlightList';

interface MessageListProps {
  messages: ChatMessage[];
}

function extractFlights(result: unknown): Flight[] | null {
  if (
    result &&
    typeof result === 'object' &&
    'structuredContent' in result &&
    result.structuredContent &&
    typeof result.structuredContent === 'object' &&
    'flights' in result.structuredContent &&
    Array.isArray((result.structuredContent as { flights: unknown }).flights)
  ) {
    return (result.structuredContent as { flights: Flight[] }).flights;
  }
  return null;
}

export function MessageList({ messages }: MessageListProps) {
  return (
    <div className="message-list">
      {messages.map((message) => {
        if (message.role === 'user' || message.role === 'error') {
          return (
            <MessageBubble
              key={message.id}
              variant={message.role}
              text={message.content as string}
            />
          );
        }

        const data = message.content as Exclude<ChatMessage['content'], string>;

        if (data.type === 'tool_execution') {
          if (data.toolCalled === 'search_flights') {
            const flights = extractFlights(data.result);
            if (flights) {
              return <FlightList key={message.id} flights={flights} />;
            }
          }

          return (
            <ToolCallCard
              key={message.id}
              toolCalled={data.toolCalled}
              arguments={data.arguments}
              result={data.result}
            />
          );
        }

        return <MessageBubble key={message.id} variant="assistant" text={data.text} />;
      })}
    </div>
  );
}

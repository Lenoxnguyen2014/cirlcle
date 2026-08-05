import { useState } from 'react';
import { runMcpChat } from '../api/mcpClient';
import { MessageList } from '../components/MessageList';
import { ChatInput } from '../components/ChatInput';
import type { ChatMessage } from '../types/chat';

const ChatPage = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSend() {
    const prompt = input.trim();
    if (!prompt || isLoading) return;

    const nextMessages: ChatMessage[] = [
      ...messages,
      { id: crypto.randomUUID(), role: 'user', content: prompt, timestamp: Date.now() },
    ];
    setMessages(nextMessages);
    setInput('');
    setIsLoading(true);

    try {
      const data = await runMcpChat(nextMessages);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: data, timestamp: Date.now() },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'error',
          content: err instanceof Error ? err.message : 'Unknown error',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="chat-page">
      <header className="chat-header">
        <h1>Flight Agent</h1>
      </header>
      <MessageList messages={messages} />
      <ChatInput value={input} onChange={setInput} onSend={handleSend} isLoading={isLoading} />
    </div>
  );
}

export default ChatPage;
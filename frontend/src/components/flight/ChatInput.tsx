interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
}

export function ChatInput({ value, onChange, onSend, isLoading }: ChatInputProps) {
  return (
    <div className="chat-input">
      <input
        type="text"
        value={value}
        placeholder="Ask the flight agent..."
        disabled={isLoading}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onSend();
          }
        }}
      />
      <button type="button" disabled={isLoading || !value.trim()} onClick={onSend}>
        {isLoading ? 'Sending…' : 'Send'}
      </button>
    </div>
  );
}

interface MessageBubbleProps {
  variant: 'user' | 'assistant' | 'error';
  text: string;
}

export function MessageBubble({ variant, text }: MessageBubbleProps) {
  return (
    <div className={`bubble bubble-${variant}`}>
      <p>{text}</p>
    </div>
  );
}

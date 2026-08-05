interface ToolCallCardProps {
  toolCalled: string;
  arguments: Record<string, unknown>;
  result: unknown;
}

function renderToolResult(result: unknown): string {
  if (
    result &&
    typeof result === 'object' &&
    'content' in result &&
    Array.isArray((result as { content: unknown }).content)
  ) {
    return (result as { content: Array<{ type: string; text?: string }> }).content
      .map((item) => (item.type === 'text' && typeof item.text === 'string' ? item.text : JSON.stringify(item)))
      .join('\n');
  }
  return typeof result === 'string' ? result : JSON.stringify(result, null, 2);
}

export function ToolCallCard({ toolCalled, arguments: args, result }: ToolCallCardProps) {
  return (
    <div className="tool-card">
      <div className="tool-card-header">
        <span className="tool-card-badge">Tool Call</span>
        <span className="tool-card-name">{toolCalled}</span>
      </div>
      {Object.keys(args).length > 0 && (
        <div className="tool-card-section">
          <span className="tool-card-label">Arguments</span>
          <pre>{JSON.stringify(args, null, 2)}</pre>
        </div>
      )}
      <div className="tool-card-section">
        <span className="tool-card-label">Result</span>
        <pre>{renderToolResult(result)}</pre>
      </div>
    </div>
  );
}

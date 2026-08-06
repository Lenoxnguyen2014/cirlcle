import { Group, Circle, Label, Tag, Text } from 'react-konva';

interface RemoteCursorProps {
  x: number;
  y: number;
  email: string;
  color: string;
}

export function RemoteCursor({ x, y, email, color }: RemoteCursorProps) {
  const label = email?.split('@')[0] || 'Guest';

  return (
    <Group x={x} y={y} listening={false}>
      <Circle radius={5} fill={color} stroke="#fff" strokeWidth={1.5} />
      <Label x={10} y={-10}>
        <Tag fill={color} cornerRadius={4} />
        <Text text={label} fontSize={11} fill="#fff" padding={4} />
      </Label>
    </Group>
  );
}

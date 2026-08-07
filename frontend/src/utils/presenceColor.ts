// Deterministic so the same user always gets the same color across clients,
// without needing to coordinate/persist a color assignment anywhere.
// Generates a hue directly (360 possible values) rather than indexing into a
// small fixed palette — a handful of fixed colors collides far too often
// (8 colors = ~12% chance of a clash with just 2 users, by the birthday
// paradox); 360 hues makes that practically a non-issue for small groups.
export function colorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 45%)`;
}

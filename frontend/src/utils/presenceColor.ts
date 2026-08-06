const PRESENCE_COLORS = ['#aa3bff', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#14b8a6', '#f97316'];

// Deterministic so the same user always gets the same color across clients,
// without needing to coordinate/persist a color assignment anywhere.
export function colorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return PRESENCE_COLORS[hash % PRESENCE_COLORS.length];
}

import type { AuthSession, AuthUser } from '../../types/auth';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

interface AuthResult {
  user: AuthUser;
  // null when the project requires email confirmation — no session exists
  // until the user clicks the confirmation link and logs in.
  session: AuthSession | null;
}

async function request(path: string, body: Record<string, unknown>): Promise<AuthResult> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Network error: unable to reach the backend');
  }

  const responseBody = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(responseBody.error ?? `Request failed with status ${res.status}`);
  }

  return responseBody.data as AuthResult;
}

export async function login(email: string, password: string): Promise<AuthResult> {
  return request('/login', { email, password });
}

export async function signup(params: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<AuthResult> {
  return request('/signup', params);
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE_URL}/api/logout`, { method: 'POST' }).catch(() => {});
}

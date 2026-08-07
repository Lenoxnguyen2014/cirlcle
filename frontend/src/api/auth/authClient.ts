import type { AuthSession, AuthUser } from '../../types/auth';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

interface AuthResult {
  user: AuthUser;
  // null when the project requires email confirmation — no session exists
  // until the user clicks the confirmation link and logs in.
  session: AuthSession | null;
}

async function request<T>(path: string, body: Record<string, unknown>): Promise<T> {
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
    // .code (e.g. "email_not_confirmed") lets callers react specifically
    // instead of just showing the raw message.
    const err = new Error(responseBody.error ?? `Request failed with status ${res.status}`) as Error & {
      code?: string;
    };
    err.code = responseBody.code;
    throw err;
  }

  return responseBody.data as T;
}

export async function login(email: string, password: string): Promise<AuthResult> {
  return request<AuthResult>('/login', { email, password });
}

export async function signup(params: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<AuthResult> {
  return request<AuthResult>('/signup', params);
}

export async function resendConfirmation(email: string): Promise<void> {
  await request<void>('/resend-confirmation', { email });
}

// Used right after an email-confirmation redirect, before any session is
// stored locally — the token comes straight from the URL hash Supabase
// appended, not from localStorage.
export async function getProfile(accessToken: string): Promise<AuthUser> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    throw new Error('Network error: unable to reach the backend');
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error ?? `Request failed with status ${res.status}`);
  }
  return body.data as AuthUser;
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE_URL}/api/logout`, { method: 'POST' }).catch(() => {});
}

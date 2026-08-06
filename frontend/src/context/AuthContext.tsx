import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabaseClient } from '../lib/supabaseClient';
import * as authApi from '../api/auth/authClient';
import type { AuthSession, AuthUser } from '../types/auth';

const STORAGE_KEY = 'board_auth';

interface StoredAuth {
  user: AuthUser;
  session: AuthSession;
}

interface AuthContextValue {
  user: AuthUser | null;
  session: AuthSession | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  // Resolves with needsEmailConfirmation: true when the project requires email
  // confirmation — no session is established yet, so the caller shouldn't
  // treat the user as logged in.
  signup: (params: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => Promise<{ needsEmailConfirmation: boolean }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStored(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredAuth) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = readStored();
    if (stored) {
      setUser(stored.user);
      setSession(stored.session);
      supabaseClient.auth.setSession(stored.session).catch(() => {});
    }
    setLoading(false);
  }, []);

  const applyAuth = async (result: { user: AuthUser; session: AuthSession }) => {
    setUser(result.user);
    setSession(result.session);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
    await supabaseClient.auth.setSession(result.session);
  };

  const login = async (email: string, password: string) => {
    const result = await authApi.login(email, password);
    if (!result.session) {
      throw new Error('Login succeeded but no session was returned — please try again.');
    }
    await applyAuth({ user: result.user, session: result.session });
  };

  const signup = async (params: { email: string; password: string; firstName: string; lastName: string }) => {
    const result = await authApi.signup(params);
    if (!result.session) {
      return { needsEmailConfirmation: true };
    }
    await applyAuth({ user: result.user, session: result.session });
    return { needsEmailConfirmation: false };
  };

  const logout = async () => {
    await authApi.logout();
    await supabaseClient.auth.signOut();
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

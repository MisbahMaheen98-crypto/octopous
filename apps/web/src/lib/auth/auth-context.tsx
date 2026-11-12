import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import {
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  type LoginInput,
} from './auth-client';
import type { AuthUser } from './types';

const EXPECTED_UNAUTHENTICATED_CODES = new Set(['AUTH_REQUIRED', 'SESSION_EXPIRED']);

type AuthContextState = {
  user: AuthUser | null;
  isLoading: boolean;
  sessionError: string | null;
  login: (input: LoginInput) => Promise<{ ok: boolean; code?: string; message?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
};

const AuthContext = createContext<AuthContextState | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await getCurrentUser();

      if (result.success) {
        setUser(result.data.user);
        setSessionError(null);
        return;
      }

      setUser(null);
      const code = result.error?.code ?? 'UNKNOWN_ERROR';
      if (EXPECTED_UNAUTHENTICATED_CODES.has(code)) {
        setSessionError(null);
      } else {
        setSessionError(result.error?.message || `Session check failed (${code})`);
      }
    } catch (error) {
      setUser(null);
      setSessionError(error instanceof Error ? error.message : 'Unable to verify session');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        await refresh();
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const login = useCallback(async (input: LoginInput) => {
    const result = await loginRequest(input);
    if (!result.success) {
      return {
        ok: false,
        code: result.error?.code ?? 'LOGIN_FAILED',
        message: result.error?.message ?? 'Login failed',
      };
    }

    setUser(result.data.user);
    setSessionError(null);
    return { ok: true };
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      setUser(null);
      setSessionError(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      sessionError,
      login,
      logout,
      refresh,
      setUser,
    }),
    [isLoading, login, logout, refresh, sessionError, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}

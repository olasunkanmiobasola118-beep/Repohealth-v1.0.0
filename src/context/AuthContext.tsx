import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, googleAuthProvider } from '../lib/firebase';
import { isPrimaryAdminEmail, isValidFirestoreId } from '../lib/admin-metrics';
import { recordUserActivityHeartbeat } from '../lib/user-metrics-sync';

const SESSION_TOKEN_KEY = 'repohealth-session-token';

export interface SessionBootstrap {
  user: {
    uid: string;
    email: string;
    name: string;
    role: string;
  };
  workspace: {
    id: number;
    name: string;
  };
  github: {
    connected: boolean;
    githubUsername?: string;
    avatarUrl?: string;
    scopes?: string;
  };
  unreadNotifications: number;
  aiPreferences: {
    diagnosisProvider: string;
    diagnosisModel: string;
    fixProvider: string;
    fixModel: string;
    assistantProvider: string;
    assistantModel: string;
    sendPrivateCodeConsent: boolean;
  } | null;
}

export interface AuthActionResult {
  ok: boolean;
  error?: string;
}

interface AuthContextValue {
  loading: boolean;
  firebaseUser: FirebaseUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  session: SessionBootstrap | null;
  authError: string | null;
  clearAuthError: () => void;
  signInWithEmail: (email: string, password: string) => Promise<AuthActionResult>;
  registerWithEmail: (name: string, email: string, password: string) => Promise<AuthActionResult>;
  signInWithGoogle: () => Promise<boolean>;
  consumeSessionToken: (token: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  apiFetch: <T = unknown>(path: string, init?: RequestInit) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function formatFirebaseAuthError(err: unknown): string {
  const code = (err as { code?: string } | null)?.code || '';
  switch (code) {
    case 'auth/popup-closed-by-user':
      return 'Google sign-in popup was closed before finishing.';
    case 'auth/popup-blocked':
      return 'Browser blocked the Google sign-in popup. Allow popups or sign in with email.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized for Google Sign-In. Please sign in with email.';
    case 'auth/operation-not-allowed':
      return 'Google Sign-In is disabled on this Firebase project. Please sign in with email.';
    case 'auth/cancelled-popup-request':
      return 'Another sign-in request superseded this popup.';
    default:
      return err instanceof Error ? err.message : 'Google Sign-In failed.';
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(SESSION_TOKEN_KEY);
  });
  const [session, setSession] = useState<SessionBootstrap | null>(null);
  const [isFirestoreAdmin, setIsFirestoreAdmin] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const sessionTokenRef = useRef<string | null>(sessionToken);
  sessionTokenRef.current = sessionToken;

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const persistSessionToken = useCallback((token: string | null) => {
    sessionTokenRef.current = token;
    setSessionToken(token);
    if (typeof window !== 'undefined') {
      if (token) {
        window.localStorage.setItem(SESSION_TOKEN_KEY, token);
      } else {
        window.localStorage.removeItem(SESSION_TOKEN_KEY);
      }
    }
  }, []);

  const apiFetch = useCallback(
    async <T = unknown>(path: string, init: RequestInit = {}): Promise<T> => {
      const headers = new Headers(init.headers);
      if (!headers.has('Content-Type') && init.body) {
        headers.set('Content-Type', 'application/json');
      }

      const currentUser = auth.currentUser;
      const customToken = sessionTokenRef.current;

      if (currentUser) {
        const token = await currentUser.getIdToken();
        headers.set('Authorization', `Bearer ${token}`);
      } else if (customToken) {
        headers.set('Authorization', `Bearer ${customToken}`);
      }

      const res = await fetch(path, { ...init, headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401 && customToken && !currentUser) {
          persistSessionToken(null);
          setSession(null);
        }
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      return data as T;
    },
    [persistSessionToken]
  );

  const refreshSession = useCallback(async (): Promise<boolean> => {
    if (!auth.currentUser && !sessionTokenRef.current) {
      setSession(null);
      return false;
    }
    try {
      const data = await apiFetch<SessionBootstrap>('/api/session/bootstrap');
      setSession(data);
      setAuthError(null);
      return true;
    } catch (err) {
      console.error('Session bootstrap failed:', err);
      setSession(null);
      setAuthError(err instanceof Error ? err.message : 'Unable to load workspace session.');
      return false;
    }
  }, [apiFetch]);

  useEffect(() => {
    let active = true;
    getRedirectResult(auth).catch(() => null);

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!active) return;
      setFirebaseUser(user);
      if (user || sessionTokenRef.current) {
        await refreshSession();
      } else {
        setSession(null);
      }
      if (active) setLoading(false);
    });
    return () => {
      active = false;
      unsub();
    };
  }, [refreshSession]);

  useEffect(() => {
    if (!firebaseUser || !firebaseUser.emailVerified || !isValidFirestoreId(firebaseUser.uid)) {
      setIsFirestoreAdmin(false);
      return;
    }

    void recordUserActivityHeartbeat(firebaseUser).catch((err) => {
      console.warn('Firestore activity sync failed:', err instanceof Error ? err.message : err);
    });

    const adminRef = doc(db, 'admins', firebaseUser.uid);
    const unsubAdmin = onSnapshot(
      adminRef,
      (snap) => {
        setIsFirestoreAdmin(snap.exists());
      },
      (err) => {
        console.warn('Firestore admin allowlist check failed:', err);
        setIsFirestoreAdmin(false);
      }
    );

    return () => {
      unsubAdmin();
    };
  }, [firebaseUser]);

  const consumeSessionToken = useCallback(
    async (token: string): Promise<boolean> => {
      if (!token) return false;
      setAuthError(null);
      persistSessionToken(token);
      return refreshSession();
    },
    [persistSessionToken, refreshSession]
  );

  const signInWithEmail = async (email: string, password: string): Promise<AuthActionResult> => {
    setAuthError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { token?: string; error?: string };
      if (!res.ok || !data.token) {
        const message = data.error || 'Invalid email or password.';
        setAuthError(message);
        return { ok: false, error: message };
      }
      const ok = await consumeSessionToken(data.token);
      if (!ok) {
        const message = 'Signed in, but workspace failed to initialize. Please try again.';
        setAuthError(message);
        return { ok: false, error: message };
      }
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to sign in.';
      setAuthError(message);
      return { ok: false, error: message };
    }
  };

  const registerWithEmail = async (
    name: string,
    email: string,
    password: string
  ): Promise<AuthActionResult> => {
    setAuthError(null);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { token?: string; error?: string };
      if (!res.ok || !data.token) {
        const message = data.error || 'Could not create account.';
        setAuthError(message);
        return { ok: false, error: message };
      }
      const ok = await consumeSessionToken(data.token);
      if (!ok) {
        const message = 'Account created, but workspace failed to initialize.';
        setAuthError(message);
        return { ok: false, error: message };
      }
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to register account.';
      setAuthError(message);
      return { ok: false, error: message };
    }
  };

  const signInWithGoogle = async (): Promise<boolean> => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleAuthProvider);
      persistSessionToken(null);
      return await refreshSession();
    } catch (err) {
      const message = formatFirebaseAuthError(err);
      setAuthError(message);
      return false;
    }
  };

  const logout = async () => {
    persistSessionToken(null);
    setSession(null);
    setIsFirestoreAdmin(false);
    setAuthError(null);
    if (auth.currentUser) {
      await signOut(auth);
    }
  };

  const isAuthenticated = Boolean(firebaseUser || sessionToken);
  const isAdmin = Boolean(
    isPrimaryAdminEmail(session?.user.email) ||
      isPrimaryAdminEmail(firebaseUser?.email) ||
      isFirestoreAdmin
  );

  return (
    <AuthContext.Provider
      value={{
        loading,
        firebaseUser,
        isAuthenticated,
        isAdmin,
        session,
        authError,
        clearAuthError,
        signInWithEmail,
        registerWithEmail,
        signInWithGoogle,
        consumeSessionToken,
        logout,
        refreshSession,
        apiFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { PublicLayout } from '../../components/PublicLayout';
import { useAuth } from '../../context/AuthContext';

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    isAuthenticated,
    signInWithEmail,
    registerWithEmail,
    signInWithGoogle,
    authError,
    clearAuthError,
  } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'email' | 'google' | null>(null);

  const targetPath = searchParams.get('connect') === 'github' ? '/app/repositories' : '/app/dashboard';

  useEffect(() => {
    setLocalError(null);
    clearAuthError();
  }, [mode, clearAuthError]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(targetPath, { replace: true });
    }
  }, [isAuthenticated, navigate, targetPath]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthError();
    setBusy('email');
    try {
      const result =
        mode === 'register'
          ? await registerWithEmail(fullName, email, password)
          : await signInWithEmail(email, password);
      if (result.ok) {
        navigate(targetPath, { replace: true });
      } else {
        setLocalError(result.error || 'Authentication failed.');
      }
    } finally {
      setBusy(null);
    }
  };

  const handleGoogle = async () => {
    setLocalError(null);
    clearAuthError();
    setBusy('google');
    try {
      const ok = await signInWithGoogle();
      if (ok) {
        navigate(targetPath, { replace: true });
      }
    } finally {
      setBusy(null);
    }
  };

  const activeError = localError || authError;

  return (
    <PublicLayout>
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="border border-[#E8E8ED] dark:border-[#2B2B34] rounded-xl p-6 sm:p-8 bg-white dark:bg-[#19191F]">
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {mode === 'login' ? 'Sign in to Repo Health' : 'Create your Repo Health workspace'}
          </h1>
          <p className="mt-2 text-sm text-[#555562] dark:text-[#9898A6]">
            Sign in with Google or your work email to manage repositories, run deterministic scans, and review AI fixes.
          </p>

          <div className="mt-6">
            <button
              type="button"
              disabled={busy !== null}
              onClick={handleGoogle}
              className="glass-btn-secondary w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg disabled:opacity-60 text-xs font-semibold"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.3h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.87c2.26-2.08 3.57-5.15 3.57-8.64z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.94-2.91l-3.87-3c-1.07.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11A12 12 0 0 0 12 24z" />
                <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.37-2.28V6.61H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.39l4-3.11z" />
                <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.61l4 3.11C6.22 6.86 8.87 4.75 12 4.75z" />
              </svg>
              <span>{busy === 'google' ? 'Connecting…' : 'Continue with Google'}</span>
            </button>
          </div>

          <div className="relative my-5 flex items-center">
            <div className="flex-1 border-t border-[#E8E8ED] dark:border-[#2B2B34]" />
            <span className="px-3 text-xs text-[#777783] dark:text-[#9898A6]">or with email</span>
            <div className="flex-1 border-t border-[#E8E8ED] dark:border-[#2B2B34]" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'register' ? (
              <div>
                <label htmlFor="auth-page-name" className="block text-xs font-medium mb-1">
                  Full name
                </label>
                <input
                  id="auth-page-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ada Lovelace"
                  className="w-full px-3 py-2 rounded-md border border-[#E8E8ED] dark:border-[#2B2B34] bg-[#F8F8FA] dark:bg-[#101014] text-sm"
                />
              </div>
            ) : null}

            <div>
              <label htmlFor="auth-page-email" className="block text-xs font-medium mb-1">
                Work email
              </label>
              <input
                id="auth-page-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="engineer@company.com"
                className="w-full px-3 py-2 rounded-md border border-[#E8E8ED] dark:border-[#2B2B34] bg-[#F8F8FA] dark:bg-[#101014] text-sm"
              />
            </div>

            <div>
              <label htmlFor="auth-page-password" className="block text-xs font-medium mb-1">
                Password
              </label>
              <input
                id="auth-page-password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 rounded-md border border-[#E8E8ED] dark:border-[#2B2B34] bg-[#F8F8FA] dark:bg-[#101014] text-sm"
              />
            </div>

            {activeError ? (
              <div
                role="alert"
                className="p-3 rounded-md border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300"
              >
                {activeError}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={busy !== null}
              className="glass-btn-primary w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg disabled:opacity-60 text-sm font-semibold"
            >
              <span>
                {busy === 'email'
                  ? mode === 'login'
                    ? 'Signing in…'
                    : 'Creating account…'
                  : mode === 'login'
                    ? 'Sign in'
                    : 'Create account'}
              </span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-[#E8E8ED] dark:border-[#2B2B34] text-xs text-[#777783] dark:text-[#9898A6] space-y-2">
            <div className="flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-[#7656D6] shrink-0 mt-0.5" />
              <span>
                Passwords use per-user scrypt hashes stored in PostgreSQL; Google sign-in is handled via Firebase Authentication.
              </span>
            </div>
            <div>
              {mode === 'login' ? (
                <span>
                  New to Repo Health?{' '}
                  <Link to="/register" className="text-[#7656D6] font-medium hover:underline">
                    Create an account
                  </Link>
                </span>
              ) : (
                <span>
                  Already have an account?{' '}
                  <Link to="/login" className="text-[#7656D6] font-medium hover:underline">
                    Sign in
                  </Link>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

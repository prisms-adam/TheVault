import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import { Loader2, ShieldCheck, UserPlus } from 'lucide-react';

interface AuthProviders {
  googleEnabled: boolean;
  localAuthEnabled: boolean;
  domain: string;
}

const SSO_ERRORS: Record<string, string> = {
  sso_unavailable: 'School Google sign-in is not configured yet.',
  sso_cancelled: 'Google sign-in was cancelled. Please try again.',
  sso_invalid_state: 'The sign-in session expired. Please try again.',
  sso_domain: 'Use your @prismsus.org school Google account.',
  sso_failed: 'Google sign-in could not be completed. Please try again.',
};

function getErrorMessage(error: unknown) {
  if (typeof error !== 'object' || error === null || !('response' in error)) return 'Authentication failed';
  const response = error.response;
  if (typeof response !== 'object' || response === null || !('data' in response)) return 'Authentication failed';
  const data = response.data;
  if (typeof data !== 'object' || data === null || !('error' in data)) return 'Authentication failed';
  if (typeof data.error === 'string') return data.error;
  if (Array.isArray(data.error)) {
    const passwordError = data.error.some((entry) => {
      if (typeof entry !== 'object' || entry === null || !('path' in entry) || !Array.isArray(entry.path)) return false;
      return entry.path.includes('password');
    });
    return passwordError ? 'Password must be at least 6 characters' : 'Invalid input data';
  }
  return 'Authentication failed';
}

const Login = () => {
  const [searchParams] = useSearchParams();
  const ssoError = searchParams.get('error');
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState(ssoError ? SSO_ERRORS[ssoError] ?? 'Google sign-in could not be completed.' : '');
  const [providers, setProviders] = useState<AuthProviders | null>(null);
  const [providerError, setProviderError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get<AuthProviders>('/auth/providers')
      .then((response) => setProviders(response.data))
      .catch(() => setProviderError('Sign-in options could not be loaded. Please refresh the page.'));
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus('loading');
    setError('');

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const response = await api.post(endpoint, { username, password });

      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        navigate(response.data.user.isAdmin ? '/admin' : '/');
        window.location.reload();
      }
    } catch (submitError) {
      setStatus('error');
      setError(getErrorMessage(submitError));
    }
  };

  return (
    <div className="mx-auto mt-20 max-w-md">
      <div className="glass rounded-3xl border border-record/20 p-10 shadow-2xl">
        <header className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-record/30 bg-record/20">
            {isLogin ? <ShieldCheck className="text-record" size={32} /> : <UserPlus className="text-record" size={32} />}
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tighter italic">
            {isLogin ? 'Vault Access' : 'New Enrollment'}
          </h1>
          <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
            {isLogin ? 'PRISMS Audio/Video Club' : 'Register for Studio Archive'}
          </p>
        </header>

        {isLogin && (
          <div className="mb-8">
            {providers?.googleEnabled ? (
              <a
                href="/vault/api/auth/google"
                data-testid="school-google-login"
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white py-4 font-black text-slate-900 transition-colors hover:bg-slate-200"
              >
                Sign in with Google
              </a>
            ) : (
              <button
                type="button"
                disabled
                data-testid="school-google-login"
                className="flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-2xl bg-white/10 py-4 font-black text-slate-500"
              >
                {providers ? 'Sign in with Google' : 'Checking sign-in options…'}
              </button>
            )}
            <p className="mt-3 text-center text-[10px] font-bold leading-relaxed text-slate-500">
              {providerError || (providers?.googleEnabled
                ? `Use your @${providers.domain} Google account.`
                : providers
                  ? 'School Google sign-in will be available after OAuth credentials are configured.'
                  : 'Loading available sign-in methods…')}
            </p>
          </div>
        )}

        {providers?.localAuthEnabled && (
          <>
            {isLogin && (
              <div className="mb-6 flex items-center gap-3 text-[9px] font-black uppercase tracking-widest text-slate-600">
                <span className="h-px flex-1 bg-white/10" /> Local account <span className="h-px flex-1 bg-white/10" />
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-6" data-testid="local-auth-form">
              <div className="space-y-2">
                <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-500">Identity</label>
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Username"
                  className="w-full rounded-xl border border-white/10 bg-onyx/50 px-4 py-3 text-sm outline-none transition-all focus:border-record"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-500">Security Key</label>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-white/10 bg-onyx/50 px-4 py-3 text-sm outline-none transition-all focus:border-record"
                  required
                />
              </div>

              <button
                disabled={status === 'loading'}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-record py-4 font-black uppercase text-white shadow-lg shadow-record/20 transition-all hover:bg-record/80 disabled:bg-slate-800"
              >
                {status === 'loading' ? <Loader2 className="animate-spin" size={20} /> : (isLogin ? 'Initialize Session' : 'Create Identity')}
              </button>
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="w-full text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 transition-colors hover:text-white"
              >
                {isLogin ? 'Need a local account? Register' : 'Already registered? Login'}
              </button>
            </form>
          </>
        )}

        {error && <p className="mt-5 text-center text-[10px] font-black uppercase tracking-widest text-record" role="alert">{error}</p>}
      </div>

      {!isLogin && providers?.localAuthEnabled && (
        <p className="mt-8 px-6 text-center text-[10px] font-black uppercase leading-relaxed tracking-widest text-slate-600">
          The first registered user will automatically be granted <span className="text-record">Master Admin</span> privileges.
        </p>
      )}
    </div>
  );
};

export default Login;

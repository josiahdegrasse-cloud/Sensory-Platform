import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useAuth } from '../contexts/auth-context';
import { AlertCircle, ArrowLeft, CheckCircle2, ChevronRight } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { NfiBrandMark } from './nfi-brand';

export interface LoginBranding {
  workspaceName?: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
}

interface Props {
  onSignup?: () => void;
  branding?: LoginBranding;
}

function NfiLoginMark({ size = 40 }: { size?: number }) {
  return (
    <div
      className="shrink-0 overflow-hidden rounded-[26%] bg-black"
      style={{ width: size, height: size }}
    >
      <NfiBrandMark size={size} monochrome />
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  );
}

function mapLoginError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials') || m.includes('invalid_credentials') || m.includes('invalid credentials'))
    return 'Incorrect email or password.';
  if (m.includes('email not confirmed'))
    return 'Please check your inbox and confirm your email before signing in.';
  if (m.includes('too many requests') || m.includes('rate limit'))
    return 'Too many attempts. Please wait a few minutes and try again.';
  if (m.includes('user not found') || m.includes('no user'))
    return 'No account found with that email address.';
  if (m.includes('provider is not enabled') || m.includes('unsupported provider'))
    return 'Google sign-in isn’t enabled for this workspace yet. Contact your administrator.';
  if (m.includes('signups not allowed'))
    return 'No account found with that email address. Create an account first, or ask your administrator for an invite.';
  if (m.includes('fetch') || m.includes('network') || m.includes('failed to fetch'))
    return 'Connection failed. Please check your internet connection.';
  return msg;
}

// Google OAuth needs one-time console setup (Google Cloud client + Supabase
// provider). Until that's done, keep the button hidden everywhere by leaving
// VITE_ENABLE_GOOGLE_SIGNIN unset; set it to 'true' to ship the button.
const googleSignInEnabled = import.meta.env.VITE_ENABLE_GOOGLE_SIGNIN === 'true';

export function LoginPage({ onSignup, branding }: Props) {
  // A tenant is "branded" once it has its own logo; until then the default NFI
  // login keeps a black brand panel with a restrained light workspace form.
  const hasBranding = !!branding?.logoUrl;
  const brandName = hasBranding ? (branding?.workspaceName || 'your') : 'NFI';
  const logoAlt = branding?.workspaceName ?? 'Logo';
  const primaryButtonBackground = branding?.primaryColor || '#111';
  const primaryButtonText = '#fff';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { login, loginWithGoogle, resetPassword, authNotice } = useAuth();

  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const errorMessage = await login(email, password);
    if (errorMessage) setError(mapLoginError(errorMessage));
    setLoading(false);
  };

  const handleGoogle = async () => {
    setError('');
    setGoogleLoading(true);
    const errorMessage = await loginWithGoogle();
    // On success the browser redirects to Google, so only failures land here.
    if (errorMessage) {
      setError(mapLoginError(errorMessage));
      setGoogleLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetLoading(true);
    const err = await resetPassword(resetEmail);
    setResetLoading(false);
    if (err) {
      setResetError(err);
    } else {
      setResetSent(true);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#111111]">
      {/* Left panel */}
      <div
        className="hidden lg:flex lg:w-[46%] flex-col justify-between border-r border-white/10 p-12 xl:p-14"
        style={{ background: '#111111' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          {hasBranding ? (
            // White plate so any brand logo (incl. dark wordmarks) reads on the
            // dark panel; `contain` keeps wide wordmarks from being cropped.
            <div style={{ background: '#fff', borderRadius: 10, padding: '10px 14px', display: 'inline-flex', alignItems: 'center' }}>
              <img
                src={branding!.logoUrl!}
                alt={logoAlt}
                style={{ height: 44, width: 'auto', maxWidth: 200, objectFit: 'contain', display: 'block' }}
              />
            </div>
          ) : (
            <>
              <NfiLoginMark size={42} />
              <div style={{ lineHeight: '1.3' }}>
                <div className="text-sm font-medium text-white/80">new</div>
                <div className="text-sm font-medium text-white/80">food</div>
                <div className="text-sm font-medium text-white/80">innovation</div>
              </div>
            </>
          )}
        </div>

        {/* Centre copy */}
        <div className="max-w-[430px]">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
            Sensory Intelligence Platform
          </p>
          <h1 className="mb-6 text-[2.625rem] font-semibold leading-[1.08] tracking-[-0.02em] text-white">
            Turn sensory evidence into confident launch decisions.
          </h1>
          <p className="max-w-[360px] text-base leading-7 text-white/60">
            Keep lab data, panel feedback, decisions, concepts, and reports moving through one controlled product workflow.
          </p>
        </div>

        {/* Footer */}
        <p className="max-w-[360px] text-sm leading-6 text-white/40">
          {hasBranding
            ? 'Powered by New Food Innovation'
            : 'Built for food teams turning research into market-ready decisions.'}
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col bg-[#f3f3ef]">
        {/* Mobile logo */}
        <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-[#111111] px-6 py-5 lg:hidden">
          <div className="flex items-center gap-3">
            {hasBranding ? (
              <div className="inline-flex items-center rounded-md bg-white px-3 py-2">
                <img
                  src={branding!.logoUrl!}
                  alt={logoAlt}
                  style={{ height: 30, width: 'auto', maxWidth: 170, objectFit: 'contain', display: 'block' }}
                />
              </div>
            ) : (
              <>
                <NfiLoginMark size={36} />
                <div style={{ lineHeight: '1.22' }}>
                  <div className="text-[11px] font-medium text-white/80">new</div>
                  <div className="text-[11px] font-medium text-white/80">food</div>
                  <div className="text-[11px] font-medium text-white/80">innovation</div>
                </div>
              </>
            )}
          </div>
          <span className="hidden text-xs font-medium uppercase tracking-[0.16em] text-white/38 sm:inline">
            Sensory Intelligence
          </span>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10 lg:px-16">
        <div className="w-full max-w-[430px]">
          {resetMode ? (
            <>
              <button
                type="button"
                onClick={() => { setResetMode(false); setResetSent(false); setResetError(''); setResetEmail(''); }}
                className="mb-7 inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-slate-500 transition-colors hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"
              >
                <ArrowLeft className="size-3.5" />
                Return to sign in
              </button>
              <div className="mb-8">
                <h2 className="text-2xl font-semibold tracking-[-0.01em] text-slate-950">Reset your password</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">Enter your workspace email. We will send a secure link if the account exists.</p>
              </div>
              {resetSent ? (
                <Alert className="border-emerald-200 bg-emerald-50 py-3">
                  <CheckCircle2 className="size-4 text-emerald-700" />
                  <AlertDescription className="text-sm text-emerald-800">
                    Check your inbox. If that email matches a workspace account, a reset link is on its way.
                  </AlertDescription>
                </Alert>
              ) : (
                <form onSubmit={handleReset} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email" className="text-sm font-medium text-slate-800">
                      Email address
                    </Label>
                    <Input
                      id="reset-email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@company.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="h-11 rounded-md border-slate-300 bg-white text-slate-950 placeholder:text-slate-500 focus-visible:border-slate-900 focus-visible:ring-slate-900/15"
                      required
                    />
                  </div>
                  {resetError && (
                    <Alert variant="destructive" className="py-3">
                      <AlertCircle className="size-4" />
                      <AlertDescription className="text-sm">{resetError}</AlertDescription>
                    </Alert>
                  )}
                  <Button
                    type="submit"
                    className="h-11 w-full rounded-md text-sm font-semibold transition-[filter,background-color] hover:brightness-90"
                    style={{ backgroundColor: primaryButtonBackground, color: primaryButtonText }}
                    disabled={resetLoading}
                  >
                    {resetLoading ? 'Sending…' : 'Email reset link'}
                  </Button>
                </form>
              )}
            </>
          ) : (
            <>
              <div className="mb-8">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Workspace sign-in</p>
                <h2 className="text-2xl font-semibold tracking-[-0.01em] text-slate-950">Welcome back</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">Open your {brandName} workspace to review studies, decisions, concepts, and reports.</p>
              </div>

              {authNotice && !error && (
                <Alert variant="destructive" className="mb-5 py-3">
                  <AlertCircle className="size-4" />
                  <AlertDescription className="text-sm">{authNotice}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-slate-800">
                    Email address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 rounded-md border-slate-300 bg-white text-slate-950 placeholder:text-slate-500 focus-visible:border-slate-900 focus-visible:ring-slate-900/15"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-slate-800">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 rounded-md border-slate-300 bg-white text-slate-950 placeholder:text-slate-500 focus-visible:border-slate-900 focus-visible:ring-slate-900/15"
                    required
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => { setResetMode(true); setError(''); }}
                    className="rounded-md text-sm font-medium text-slate-500 transition-colors hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"
                  >
                    Forgot password?
                  </button>
                </div>

                {error && (
                  <Alert variant="destructive" className="py-3">
                    <AlertCircle className="size-4" />
                    <AlertDescription className="text-sm">{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="h-11 w-full rounded-md text-sm font-semibold transition-[filter,background-color] hover:brightness-90"
                  style={{ backgroundColor: primaryButtonBackground, color: primaryButtonText }}
                  disabled={loading}
                >
                  {loading ? 'Signing in…' : (
                    <span className="flex items-center gap-2">
                      Sign in <ChevronRight className="size-4" />
                    </span>
                  )}
                </Button>
              </form>

              {googleSignInEnabled && (
                <>
                  <div className="my-5 flex items-center gap-3">
                    <div className="h-px flex-1 bg-slate-200" />
                    <span className="text-xs uppercase tracking-wide text-slate-400">or</span>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGoogle}
                    disabled={googleLoading}
                    className="h-11 w-full rounded-md border-slate-300 bg-white text-sm font-semibold text-slate-800 hover:border-slate-400 hover:bg-slate-50"
                  >
                    <span className="flex items-center gap-2.5">
                      <GoogleMark />
                      {googleLoading ? 'Redirecting…' : 'Continue with Google'}
                    </span>
                  </Button>
                </>
              )}

              <div className="mt-7 border-t border-slate-300/70 pt-6 text-center">
                {onSignup ? (
                  <button
                    type="button"
                    onClick={onSignup}
                    className="rounded-md text-sm text-slate-600 transition-colors hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"
                  >
                    Joining a panel?{' '}
                    <span className="font-semibold underline underline-offset-2">Create account</span>
                  </button>
                ) : (
                  <p className="text-sm leading-6 text-slate-600">Panelist access is managed by the workspace admin.</p>
                )}
                <div className="mt-5 flex items-center justify-center gap-3 text-xs font-medium text-slate-500">
                  <a href="/privacy" className="rounded-sm hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20">Privacy</a>
                  <span aria-hidden="true">/</span>
                  <a href="/terms" className="rounded-sm hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20">Terms</a>
                  <span aria-hidden="true">/</span>
                  <a href="/panelist-consent" className="rounded-sm hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20">Consent</a>
                </div>
              </div>
            </>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}

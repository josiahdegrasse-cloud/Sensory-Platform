import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useAuth } from '../contexts/auth-context';
import { AlertCircle, CheckCircle2, ChevronRight, Mail } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';

export interface LoginBranding {
  workspaceName?: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
}

interface Props {
  onSignup?: () => void;
  branding?: LoginBranding;
}


function NfiLogoMark({ size = 40 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '26%', overflow: 'hidden', background: '#000', flexShrink: 0 }}>
      <img
        src="/new_foodinnovation_ltd_logo.jpg"
        alt="NFI"
        style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(1) contrast(10)', transform: 'scale(1.18)' }}
      />
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
  // look is preserved exactly (accent stays #111 with the #333 hover).
  const hasBranding = !!branding?.logoUrl;
  const brandName = hasBranding ? (branding?.workspaceName || 'your') : 'NFI';
  const accent = branding?.primaryColor || '#111';
  const accentHover = branding?.primaryColor || '#333';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { login, loginWithGoogle, loginWithMagicLink, resetPassword, authNotice } = useAuth();

  const [magicMode, setMagicMode] = useState(false);
  const [magicEmail, setMagicEmail] = useState('');
  const [magicSent, setMagicSent] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [magicError, setMagicError] = useState('');

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

  const handleMagic = async (e: React.FormEvent) => {
    e.preventDefault();
    setMagicError('');
    setMagicLoading(true);
    const errorMessage = await loginWithMagicLink(magicEmail);
    setMagicLoading(false);
    if (errorMessage) {
      setMagicError(mapLoginError(errorMessage));
    } else {
      setMagicSent(true);
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
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div
        className="hidden lg:flex lg:w-[46%] flex-col justify-between p-12"
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
                alt={branding?.workspaceName ?? 'Logo'}
                style={{ height: 44, width: 'auto', maxWidth: 200, objectFit: 'contain', display: 'block' }}
              />
            </div>
          ) : (
            <>
              <NfiLogoMark size={42} />
              <div style={{ lineHeight: '1.3' }}>
                <div className="text-white/80 text-sm">new</div>
                <div className="text-white/80 text-sm">food</div>
                <div className="text-white/80 text-sm">innovation</div>
              </div>
            </>
          )}
        </div>

        {/* Centre copy */}
        <div>
          <p className="text-white/35 text-xs font-semibold uppercase tracking-widest mb-5">
            Sensory Analysis Platform
          </p>
          <h1 className="text-[2.5rem] font-bold text-white leading-[1.15] mb-6">
            Guiding your journey,<br />
            from concept to<br />
            commercialisation.
          </h1>
          <p className="text-white/45 text-base leading-relaxed max-w-[300px]">
            A professional sensory intelligence platform for food developers, R&D teams, and innovation consultants.
          </p>
        </div>

        {/* Footer */}
        <p className="text-white/25 text-sm">
          {hasBranding
            ? 'Powered by New Food Innovation'
            : 'Supporting over 60 international food companies.'}
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-16 bg-white">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-3 mb-8">
          {hasBranding ? (
            // Mobile right panel is white, so the contained logo shows as-is.
            <img
              src={branding!.logoUrl!}
              alt={branding?.workspaceName ?? 'Logo'}
              style={{ height: 32, width: 'auto', maxWidth: 180, objectFit: 'contain', display: 'block' }}
            />
          ) : (
            <>
              <NfiLogoMark size={36} />
              <div style={{ lineHeight: '1.22' }}>
                <div className="text-[11px] text-slate-700">new</div>
                <div className="text-[11px] text-slate-700">food</div>
                <div className="text-[11px] text-slate-700">innovation</div>
              </div>
            </>
          )}
        </div>

        <div className="max-w-sm w-full mx-auto">
          {resetMode ? (
            <>
              <button
                type="button"
                onClick={() => { setResetMode(false); setResetSent(false); setResetError(''); setResetEmail(''); }}
                className="text-xs text-slate-400 hover:text-slate-700 transition-colors mb-6"
              >
                ← Back to sign in
              </button>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900">Reset password</h2>
                <p className="text-slate-500 text-sm mt-1">We'll send a link to your email address</p>
              </div>
              {resetSent ? (
                <Alert className="py-2.5 border-green-200 bg-green-50">
                  <CheckCircle2 className="size-4 text-green-600" />
                  <AlertDescription className="text-xs text-green-700">
                    Check your email — a reset link is on its way.
                  </AlertDescription>
                </Alert>
              ) : (
                <form onSubmit={handleReset} className="space-y-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="reset-email" className="text-slate-700 font-medium text-sm">
                      Email address
                    </Label>
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="you@company.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="h-11 border-slate-200 rounded-lg"
                      required
                    />
                  </div>
                  {resetError && (
                    <Alert variant="destructive" className="py-2.5">
                      <AlertCircle className="size-4" />
                      <AlertDescription className="text-xs">{resetError}</AlertDescription>
                    </Alert>
                  )}
                  <Button
                    type="submit"
                    className="w-full h-11 text-white font-semibold text-sm rounded-lg transition-colors"
                    style={{ background: accent }}
                    onMouseEnter={e => (e.currentTarget.style.background = accentHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = accent)}
                    disabled={resetLoading}
                  >
                    {resetLoading ? 'Sending…' : 'Send reset link'}
                  </Button>
                </form>
              )}
            </>
          ) : magicMode ? (
            <>
              <button
                type="button"
                onClick={() => { setMagicMode(false); setMagicSent(false); setMagicError(''); }}
                className="text-xs text-slate-400 hover:text-slate-700 transition-colors mb-6"
              >
                ← Back to sign in
              </button>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900">Email me a sign-in link</h2>
                <p className="text-slate-500 text-sm mt-1">No password needed — we'll send a one-time link to your inbox</p>
              </div>
              {magicSent ? (
                <Alert className="py-2.5 border-green-200 bg-green-50">
                  <CheckCircle2 className="size-4 text-green-600" />
                  <AlertDescription className="text-xs text-green-700">
                    Check your email — your sign-in link is on its way. You can close this tab.
                  </AlertDescription>
                </Alert>
              ) : (
                <form onSubmit={handleMagic} className="space-y-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="magic-email" className="text-slate-700 font-medium text-sm">
                      Email address
                    </Label>
                    <Input
                      id="magic-email"
                      type="email"
                      placeholder="you@company.com"
                      value={magicEmail}
                      onChange={(e) => setMagicEmail(e.target.value)}
                      className="h-11 border-slate-200 rounded-lg"
                      required
                    />
                  </div>
                  {magicError && (
                    <Alert variant="destructive" className="py-2.5">
                      <AlertCircle className="size-4" />
                      <AlertDescription className="text-xs">{magicError}</AlertDescription>
                    </Alert>
                  )}
                  <Button
                    type="submit"
                    className="w-full h-11 text-white font-semibold text-sm rounded-lg transition-colors"
                    style={{ background: accent }}
                    onMouseEnter={e => (e.currentTarget.style.background = accentHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = accent)}
                    disabled={magicLoading}
                  >
                    {magicLoading ? 'Sending…' : 'Send sign-in link'}
                  </Button>
                </form>
              )}
            </>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900">Sign in</h2>
                <p className="text-slate-500 text-sm mt-1">Access your {brandName} workspace</p>
              </div>

              {authNotice && !error && (
                <Alert variant="destructive" className="py-2.5 mb-5">
                  <AlertCircle className="size-4" />
                  <AlertDescription className="text-xs">{authNotice}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-slate-700 font-medium text-sm">
                    Email address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 border-slate-200 rounded-lg"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-slate-700 font-medium text-sm">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 border-slate-200 rounded-lg"
                    required
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => { setResetMode(true); setError(''); }}
                    className="text-xs text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>

                {error && (
                  <Alert variant="destructive" className="py-2.5">
                    <AlertCircle className="size-4" />
                    <AlertDescription className="text-xs">{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="w-full h-11 text-white font-semibold text-sm rounded-lg transition-colors"
                  style={{ background: accent }}
                  onMouseEnter={e => (e.currentTarget.style.background = accentHover)}
                  onMouseLeave={e => (e.currentTarget.style.background = accent)}
                  disabled={loading}
                >
                  {loading ? 'Signing in…' : (
                    <span className="flex items-center gap-2">
                      Sign In <ChevronRight className="size-4" />
                    </span>
                  )}
                </Button>
              </form>

              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs uppercase tracking-wide text-slate-400">or</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              {googleSignInEnabled && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGoogle}
                  disabled={googleLoading}
                  className="mb-3 w-full h-11 border-slate-200 rounded-lg font-semibold text-sm text-slate-700 hover:bg-slate-50"
                >
                  <span className="flex items-center gap-2.5">
                    <GoogleMark />
                    {googleLoading ? 'Redirecting…' : 'Continue with Google'}
                  </span>
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={() => { setMagicEmail(email); setMagicMode(true); setError(''); }}
                className="w-full h-11 border-slate-200 rounded-lg font-semibold text-sm text-slate-700 hover:bg-slate-50"
              >
                <span className="flex items-center gap-2.5">
                  <Mail className="size-[18px] text-slate-500" />
                  Email me a sign-in link
                </span>
              </Button>

              <div className="mt-6 pt-6 border-t border-slate-100 text-center">
                {onSignup ? (
                  <button
                    type="button"
                    onClick={onSignup}
                    className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
                  >
                    New panelist?{' '}
                    <span className="font-semibold underline underline-offset-2">Create account</span>
                  </button>
                ) : (
                  <p className="text-sm text-slate-500">Panelist accounts are invite-only for this workspace.</p>
                )}
                <div className="mt-4 flex items-center justify-center gap-3 text-xs text-slate-400">
                  <a href="/privacy" className="hover:text-slate-700">Privacy</a>
                  <span aria-hidden="true">/</span>
                  <a href="/terms" className="hover:text-slate-700">Terms</a>
                  <span aria-hidden="true">/</span>
                  <a href="/panelist-consent" className="hover:text-slate-700">Consent</a>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

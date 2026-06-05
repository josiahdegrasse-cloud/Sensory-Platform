import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useAuth } from '../contexts/auth-context';
import { AlertCircle, CheckCircle2, ChevronRight, FlaskConical, LineChart, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';

interface Props {
  onSignup: () => void;
}

const NFI_BLUE = '#6B7890';

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
  if (m.includes('fetch') || m.includes('network') || m.includes('failed to fetch'))
    return 'Connection failed. Please check your internet connection.';
  return msg;
}

export function LoginPage({ onSignup }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, resetPassword } = useAuth();

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
        className="hidden lg:flex lg:w-[48%] flex-col justify-between p-12 relative overflow-hidden"
        style={{
          background:
            'radial-gradient(circle at 18% 18%, rgba(107,120,144,0.32), transparent 28%), radial-gradient(circle at 78% 72%, rgba(16,185,129,0.18), transparent 30%), linear-gradient(145deg, #0b0f14 0%, #111111 46%, #18202a 100%)',
        }}
      >
        <div
          className="absolute inset-0 opacity-[0.09]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.55) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />
        <div className="absolute left-12 right-12 top-28 h-px bg-white/10" />
        <div className="absolute -right-20 top-28 h-72 w-72 rounded-full border border-white/10" />
        <div className="absolute -right-10 top-44 h-48 w-48 rounded-full border border-white/10" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <NfiLogoMark size={42} />
          <div style={{ lineHeight: '1.3' }}>
            <div className="text-white/80 text-sm">new</div>
            <div className="text-white/80 text-sm">food</div>
            <div className="text-white/80 text-sm">innovation</div>
          </div>
        </div>

        {/* Centre copy */}
        <div className="relative z-10 max-w-[460px]">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3 py-1.5 text-xs font-medium text-white/70">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Sensory intelligence platform
          </div>
          <h1 className="text-[2.75rem] font-semibold text-white leading-[1.08] mb-6">
            Food innovation, measured from lab bench to panel room.
          </h1>
          <p className="text-white/58 text-base leading-relaxed max-w-[390px]">
            Import instrument data, generate panel surveys, and move from formulation evidence to confident product decisions.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-3">
            {[
              { label: 'Machine data', icon: FlaskConical },
              { label: 'Panel insight', icon: LineChart },
              { label: 'Decision audit', icon: ShieldCheck },
            ].map(({ label, icon: Icon }) => (
              <div key={label} className="rounded-xl border border-white/12 bg-white/[0.06] p-3">
                <Icon className="mb-2 size-4 text-white/70" />
                <div className="text-xs font-medium text-white/68">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-6 text-sm text-white/35">
          <span>Supporting international food teams</span>
          <span className="font-mono text-xs text-white/28">NFI OS</span>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-16 bg-white">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-3 mb-8">
          <NfiLogoMark size={36} />
          <div style={{ lineHeight: '1.22' }}>
            <div className="text-[11px] text-slate-700">new</div>
            <div className="text-[11px] text-slate-700">food</div>
            <div className="text-[11px] text-slate-700">innovation</div>
          </div>
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
                    style={{ background: '#111' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#333')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#111')}
                    disabled={resetLoading}
                  >
                    {resetLoading ? 'Sending…' : 'Send reset link'}
                  </Button>
                </form>
              )}
            </>
          ) : (
            <>
              <div className="mb-8">
                <div className="mb-3 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                  Professional workspace
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Sign in to NFI</h2>
                <p className="text-slate-500 text-sm mt-1">Continue your sensory projects and panel surveys.</p>
              </div>

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
                  style={{ background: '#111' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#333')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#111')}
                  disabled={loading}
                >
                  {loading ? 'Signing in…' : (
                    <span className="flex items-center gap-2">
                      Sign In <ChevronRight className="size-4" />
                    </span>
                  )}
                </Button>
              </form>

              <div className="mt-6 pt-6 border-t border-slate-100 text-center">
                <button
                  type="button"
                  onClick={onSignup}
                  className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
                >
                  New panelist?{' '}
                  <span className="font-semibold underline underline-offset-2">Create account</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useAuth } from '../contexts/auth-context';
import { AlertCircle, ChevronRight } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';

interface Props {
  onSignup: () => void;
}

const NFI_DARK = '#111111';

function NfiLogoMark({ size = 40, invert = false }: { size?: number; invert?: boolean }) {
  return (
    <div
      className="relative flex items-center justify-center rounded-xl flex-shrink-0"
      style={{
        width: size,
        height: size,
        background: invert ? 'rgba(255,255,255,0.15)' : NFI_DARK,
        border: invert ? '1px solid rgba(255,255,255,0.25)' : 'none',
      }}
    >
      <svg
        className="absolute"
        style={{ top: Math.round(size * 0.11), right: Math.round(size * 0.14) }}
        width={Math.round(size * 0.33)}
        height={Math.round(size * 0.25)}
        viewBox="0 0 12 9"
        fill="none"
      >
        <path d="M2.5 8.5C2.5 5.5 1 3.5 0 2.5C1 0.8 3.8 1.2 4.2 4.5" fill={invert ? 'rgba(255,255,255,0.6)' : '#8899aa'}/>
        <path d="M9.5 8.5C9.5 5.5 11 3.5 12 2.5C11 0.8 8.2 1.2 7.8 4.5" fill={invert ? 'rgba(255,255,255,0.6)' : '#8899aa'}/>
      </svg>
      <span
        className="font-bold select-none"
        style={{
          fontSize: size * 0.36,
          letterSpacing: '-0.02em',
          color: 'white',
        }}
      >
        ñfi
      </span>
    </div>
  );
}

export function LoginPage({ onSignup }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const errorMessage = await login(email, password);
    if (errorMessage) {
      setError(errorMessage);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — NFI dark brand */}
      <div
        className="hidden lg:flex lg:w-[46%] flex-col justify-between p-12"
        style={{ background: NFI_DARK }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <NfiLogoMark size={40} invert />
          <div className="leading-none" style={{ lineHeight: '1.3' }}>
            <div className="text-white/90 text-sm">new</div>
            <div className="text-white/90 text-sm">food</div>
            <div className="text-white/90 text-sm">innovation</div>
          </div>
        </div>

        {/* Centre copy */}
        <div>
          <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-5">
            Sensory Analysis Platform
          </p>
          <h1 className="text-[2.5rem] font-bold text-white leading-[1.15] mb-6">
            Guiding your journey,<br />
            from concept to<br />
            commercialisation.
          </h1>
          <p className="text-white/50 text-base leading-relaxed max-w-[300px]">
            A professional sensory intelligence platform for food developers, R&D teams, and innovation consultants.
          </p>
        </div>

        {/* Footer */}
        <p className="text-white/30 text-sm">
          Supporting over 60 international food companies.
        </p>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-16 bg-white">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-3 mb-8">
          <NfiLogoMark size={36} />
          <div className="leading-none" style={{ lineHeight: '1.25' }}>
            <div className="text-[11px] text-slate-700">new</div>
            <div className="text-[11px] text-slate-700">food</div>
            <div className="text-[11px] text-slate-700">innovation</div>
          </div>
        </div>

        <div className="max-w-sm w-full mx-auto">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Sign in</h2>
            <p className="text-slate-500 text-sm mt-1">Access your NFI workspace</p>
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

            {error && (
              <Alert variant="destructive" className="py-2.5">
                <AlertCircle className="size-4" />
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full h-11 text-white font-semibold text-sm rounded-lg transition-colors"
              style={{ background: NFI_DARK }}
              onMouseEnter={e => (e.currentTarget.style.background = '#2a2a2a')}
              onMouseLeave={e => (e.currentTarget.style.background = NFI_DARK)}
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
        </div>
      </div>
    </div>
  );
}

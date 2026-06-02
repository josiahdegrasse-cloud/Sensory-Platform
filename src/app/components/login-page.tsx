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

const NFI_ORANGE = '#e07856';
const NFI_DARK = '#1a1a22';

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
      {/* Left panel — NFI brand */}
      <div
        className="hidden lg:flex lg:w-[46%] flex-col justify-between p-12"
        style={{ background: NFI_ORANGE }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.2)' }}
          >
            <span className="text-white font-bold text-sm select-none tracking-tight">nfi</span>
          </div>
          <div>
            <div className="text-white font-semibold text-base leading-none">new food innovation</div>
          </div>
        </div>

        {/* Centre copy */}
        <div>
          <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-5">
            Sensory Analysis Platform
          </p>
          <h1 className="text-[2.6rem] font-bold text-white leading-[1.15] mb-6">
            Guiding your journey,<br />
            from concept to<br />
            commercialisation.
          </h1>
          <p className="text-white/75 text-base leading-relaxed max-w-[320px]">
            A professional sensory intelligence platform for food developers, R&D teams, and innovation consultants.
          </p>
        </div>

        {/* Footer line */}
        <p className="text-white/50 text-sm">
          Supporting over 60 international food companies.
        </p>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-16 bg-white">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-3 mb-8">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: NFI_DARK }}
          >
            <span className="text-white font-bold text-xs tracking-tight select-none">nfi</span>
          </div>
          <div>
            <div className="font-semibold text-slate-900 leading-none">new food innovation</div>
            <div className="text-xs text-slate-400 tracking-widest uppercase mt-0.5">Sensory Analysis Platform</div>
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
              style={{ background: NFI_ORANGE }}
              onMouseEnter={e => (e.currentTarget.style.background = '#c96840')}
              onMouseLeave={e => (e.currentTarget.style.background = NFI_ORANGE)}
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
              className="text-sm text-slate-500 transition-colors"
              onMouseEnter={e => (e.currentTarget.style.color = NFI_ORANGE)}
              onMouseLeave={e => (e.currentTarget.style.color = '')}
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

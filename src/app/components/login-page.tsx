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
      {/* Left panel — hero */}
      <div
        className="hidden lg:flex lg:w-[58%] relative flex-col justify-between p-10 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0f0f14 0%, #1a1a22 40%, #22222e 100%)' }}
      >
        {/* Decorative NFI-style bubbles */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute -top-16 -right-16 w-[380px] h-[380px] rounded-full opacity-[0.07]"
            style={{ background: '#e07856' }}
          />
          <div
            className="absolute -top-8 right-20 w-[220px] h-[220px] rounded-full opacity-[0.05]"
            style={{ background: '#e07856' }}
          />
          <div
            className="absolute bottom-20 -left-20 w-[280px] h-[280px] rounded-full opacity-[0.06]"
            style={{ background: '#38b8b8' }}
          />
        </div>

        {/* NFI logo — top left */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-sm tracking-tight select-none">nfi</span>
          </div>
          <div>
            <div className="text-white font-bold text-lg leading-none">new food innovation</div>
            <div className="text-white/50 text-xs font-medium tracking-widest uppercase mt-0.5">Sensory Analysis Platform</div>
          </div>
        </div>

        {/* Center hero copy */}
        <div className="relative z-10 max-w-md">
          <h1 className="text-5xl font-black text-white leading-tight mb-4">
            Innovation
            <br />
            <span style={{ color: '#e07856' }}>starts with</span>
            <br />
            insight.
          </h1>
          <p className="text-white/60 text-lg leading-relaxed mb-8">
            Assess products, design consumer surveys, and launch concept tests — all in one sensory intelligence platform.
          </p>
          <div className="flex flex-wrap gap-3">
            {['Sensory Evaluation', 'Consumer Panels', 'Concept Testing', 'R&D Analytics'].map(tag => (
              <span
                key={tag}
                className="px-3 py-1.5 rounded-full text-xs font-semibold border border-white/20 text-white/70 bg-white/5 backdrop-blur-sm"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom stat strip */}
        <div className="relative z-10 flex gap-8">
          {[
            { value: '94%', label: 'Panel agreement' },
            { value: '100+', label: 'Panelist capacity' },
            { value: '4', label: 'Evaluation modules' },
          ].map(stat => (
            <div key={stat.label}>
              <div className="text-2xl font-black text-white">{stat.value}</div>
              <div className="text-white/40 text-xs mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-16 bg-white">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-[#1a1a22] flex items-center justify-center">
            <span className="text-white font-bold text-xs tracking-tight select-none">nfi</span>
          </div>
          <div>
            <div className="font-bold text-slate-900 leading-none">new food innovation</div>
            <div className="text-xs text-slate-500 tracking-widest uppercase">Sensory Analysis Platform</div>
          </div>
        </div>

        <div className="max-w-sm w-full mx-auto">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Sign in</h2>
            <p className="text-slate-500 text-sm mt-1">Access your NFI workspace</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-slate-700 font-medium text-sm">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 border-slate-200 focus:border-[#e07856] focus:ring-[#e07856]"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-slate-700 font-medium text-sm">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 border-slate-200 focus:border-[#e07856] focus:ring-[#e07856]"
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
              className="w-full h-11 text-white font-semibold text-sm rounded-lg"
              style={{ background: '#e07856' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#d06846')}
              onMouseLeave={e => (e.currentTarget.style.background = '#e07856')}
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
              className="text-sm text-slate-500 hover:text-[#e07856] transition-colors"
            >
              New panelist? <span className="font-semibold underline underline-offset-2">Create account</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

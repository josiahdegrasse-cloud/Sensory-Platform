import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useAuth } from '../contexts/auth-context';
import { AlertCircle, Beaker, ChevronRight } from 'lucide-react';
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
      {/* Left panel — hero image bleed */}
      <div
        className="hidden lg:flex lg:w-[58%] relative flex-col justify-between p-10 overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0f2417 0%, #1a3a24 30%, #2d5a3d 60%, #1e4d3a 80%, #0d2318 100%)',
        }}
      >
        {/* Texture overlay */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 80%, rgba(180,140,60,0.4) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(100,180,120,0.3) 0%, transparent 50%), radial-gradient(circle at 50% 50%, rgba(255,255,255,0.03) 0%, transparent 60%)',
          }}
        />

        {/* Abstract food shapes */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, rgba(180,140,60,0.8) 0%, transparent 70%)' }}
          />
          <div
            className="absolute top-20 -left-20 w-[300px] h-[300px] rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, rgba(100,200,130,0.8) 0%, transparent 70%)' }}
          />
        </div>

        {/* NFI logo — top left */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg">
            <Beaker className="size-5 text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-lg leading-none tracking-wide">NFI</div>
            <div className="text-emerald-300 text-xs font-medium tracking-widest uppercase">New Food Innovation</div>
          </div>
        </div>

        {/* Center hero copy */}
        <div className="relative z-10 max-w-md">
          <h1 className="text-5xl font-black text-white leading-tight mb-4">
            Innovation
            <br />
            <span className="text-emerald-400">starts with</span>
            <br />
            insight.
          </h1>
          <p className="text-emerald-100/80 text-lg leading-relaxed mb-8">
            Assess products, design consumer surveys, and launch concept tests — all in one sensory intelligence platform.
          </p>
          <div className="flex flex-wrap gap-3">
            {['Sensory Evaluation', 'Consumer Panels', 'Concept Testing', 'R&D Analytics'].map(tag => (
              <span
                key={tag}
                className="px-3 py-1.5 rounded-full text-xs font-semibold border border-emerald-400/40 text-emerald-300 bg-emerald-900/40 backdrop-blur-sm"
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
              <div className="text-emerald-300/70 text-xs mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-16 bg-white">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center">
            <Beaker className="size-4 text-white" />
          </div>
          <div>
            <div className="font-bold text-slate-900 leading-none">NFI</div>
            <div className="text-xs text-slate-500 tracking-widest uppercase">New Food Innovation</div>
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
                className="h-11 border-slate-200 focus:border-emerald-500 focus:ring-emerald-500"
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
                className="h-11 border-slate-200 focus:border-emerald-500 focus:ring-emerald-500"
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
              className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg"
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
              className="text-sm text-slate-500 hover:text-emerald-700 transition-colors"
            >
              New panelist? <span className="font-semibold underline underline-offset-2">Create account</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

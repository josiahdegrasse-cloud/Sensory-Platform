import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/auth-context';

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

export function ResetPasswordPage() {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    const err = await updatePassword(password);
    setLoading(false);
    if (err) { setError(err); return; }
    setDone(true);
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-[46%] flex-col justify-between p-12" style={{ background: '#111111' }}>
        <div className="flex items-center gap-3">
          <NfiLogoMark size={42} />
          <div style={{ lineHeight: '1.3' }}>
            <div className="text-white/80 text-sm">new</div>
            <div className="text-white/80 text-sm">food</div>
            <div className="text-white/80 text-sm">innovation</div>
          </div>
        </div>
        <div>
          <p className="text-white/35 text-xs font-semibold uppercase tracking-widest mb-5">Sensory Analysis Platform</p>
          <h1 className="text-[2.5rem] font-bold text-white leading-[1.15] mb-6">
            Set a new<br />password.
          </h1>
        </div>
        <p className="text-white/25 text-sm">Supporting over 60 international food companies.</p>
      </div>

      <div className="flex-1 flex flex-col justify-center px-8 sm:px-16 bg-white">
        <div className="max-w-sm w-full mx-auto">
          {done ? (
            <div className="space-y-6">
              <Alert className="border-emerald-300 bg-emerald-50">
                <CheckCircle2 className="size-4 text-emerald-600" />
                <AlertDescription className="text-emerald-700">
                  Password updated. You can now sign in with your new password.
                </AlertDescription>
              </Alert>
              <p className="text-sm text-slate-500 text-center">You have been signed out — please sign in again.</p>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900">Set new password</h2>
                <p className="text-slate-500 text-sm mt-1">Choose a password at least 8 characters long</p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-slate-700 font-medium text-sm">New password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="h-11 border-slate-200 rounded-lg"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm" className="text-slate-700 font-medium text-sm">Confirm password</Label>
                  <Input
                    id="confirm"
                    type="password"
                    placeholder="••••••••"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
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
                  className="w-full h-11 text-white font-semibold text-sm rounded-lg"
                  style={{ background: '#111' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#333')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#111')}
                  disabled={loading}
                >
                  {loading ? 'Updating…' : 'Set new password'}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

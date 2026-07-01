import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/auth-context';
import { NFI_BRAND_COLOR, NFI_BRAND_COLOR_DARK } from '../lib/nfi-brand';
import { NfiBrandLockup } from './nfi-brand';

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
    <div className="min-h-screen flex bg-white">
      <div className="hidden lg:flex lg:w-[46%] flex-col justify-between border-r border-slate-200 bg-slate-50 p-12">
        <NfiBrandLockup markSize={44} textClassName="text-slate-700" />
        <div>
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Sensory Analysis Platform</p>
          <h1 className="mb-6 max-w-[24rem] text-[2.65rem] font-bold leading-[1.08] tracking-[-0.02em] text-slate-900">
            Set a new password.
          </h1>
          <p className="max-w-[23rem] text-base leading-7 text-slate-700">
            Keep access to your sensory evidence, decisions, and commercialization reports protected.
          </p>
        </div>
        <p className="max-w-sm text-sm text-slate-500">Scientific enough for product teams. Clear enough for commercial decisions.</p>
      </div>

      <div className="flex-1 flex flex-col justify-center px-8 sm:px-16 bg-white">
        <div className="lg:hidden mb-8">
          <NfiBrandLockup markSize={36} textClassName="text-slate-700 [&_div]:text-[11px]" />
        </div>
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
                  style={{ background: NFI_BRAND_COLOR }}
                  onMouseEnter={e => (e.currentTarget.style.background = NFI_BRAND_COLOR_DARK)}
                  onMouseLeave={e => (e.currentTarget.style.background = NFI_BRAND_COLOR)}
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

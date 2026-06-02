import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { supabase } from '../lib/supabase';
import { AlertCircle, CheckCircle2, FlaskConical } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';

interface Props {
  onBack: () => void;
}

export function SignupPage({ onBack }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const validatePassword = (pw: string): string | null => {
    if (pw.length < 8) return 'Password must be at least 8 characters.';
    if (!/[A-Z]/.test(pw)) return 'Password must include at least one uppercase letter.';
    if (!/[0-9]/.test(pw)) return 'Password must include at least one number.';
    return null;
  };

  function mapSignupError(msg: string): string {
    const m = msg.toLowerCase();
    if (m.includes('user already registered') || m.includes('already registered') || m.includes('already exists'))
      return 'An account with this email already exists. Try signing in instead.';
    if (m.includes('invalid email') || m.includes('unable to validate email'))
      return 'Please enter a valid email address.';
    if (m.includes('password') && m.includes('weak'))
      return 'Password is too weak. Use at least 8 characters, one uppercase letter, and one number.';
    if (m.includes('too many requests') || m.includes('rate limit'))
      return 'Too many attempts. Please wait a few minutes and try again.';
    if (m.includes('fetch') || m.includes('network') || m.includes('failed to fetch'))
      return 'Connection failed. Please check your internet connection.';
    return msg;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!consentGiven) { setError('You must agree to the data processing terms to create an account.'); return; }
    const pwError = validatePassword(password);
    if (pwError) { setError(pwError); return; }
    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });

    if (signUpError) {
      setError(mapSignupError(signUpError.message));
      setLoading(false);
      return;
    }

    if (data.user) {
      await supabase.from('profiles').upsert({ id: data.user.id, name, role: 'panelist' });
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <Card className="shadow-2xl">
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <CheckCircle2 className="size-16 text-emerald-600 mx-auto" />
              <h2 className="text-2xl font-bold text-slate-900">Account Created!</h2>
              <p className="text-slate-600">Your panelist account is ready. Sign in to get started.</p>
              <Button onClick={onBack} className="w-full bg-slate-900 hover:bg-slate-700">
                Sign In
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <Card className="shadow-2xl">
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center">
                <FlaskConical className="size-7 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl">Create Account</CardTitle>
                <p className="text-sm text-slate-600">Join as a panelist</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
                <p className="text-xs text-slate-400">Min 8 characters, one uppercase letter, one number.</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <p className="text-xs text-slate-600 font-medium">Data Processing Notice (UK GDPR)</p>
                <p className="text-xs text-slate-500">
                  Your name, email, and evaluation responses will be stored securely and used solely for food product research by the study administrator. You may request deletion of your data at any time by contacting the administrator.
                </p>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentGiven}
                    onChange={e => setConsentGiven(e.target.checked)}
                    className="mt-0.5 accent-slate-900"
                    required
                  />
                  <span className="text-xs text-slate-700">
                    I agree to my data being processed for sensory research purposes as described above.
                  </span>
                </label>
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button
                type="submit"
                className="w-full bg-slate-900 hover:bg-slate-700"
                disabled={loading || !consentGiven}
              >
                {loading ? 'Creating account…' : 'Create Account'}
              </Button>
              <button
                type="button"
                onClick={onBack}
                className="w-full text-sm text-slate-500 hover:text-slate-900"
              >
                Already have an account? Sign in
              </button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

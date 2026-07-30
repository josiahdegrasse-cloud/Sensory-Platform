import { useState, type CSSProperties } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { supabase } from '../lib/supabase';
import { AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { CURRENT_CONSENT_VERSION, emailDomainHasWorkspace } from '../lib/database';
import type { LoginBranding } from './login-page';
import { TenantOrNfiLogo } from './nfi-brand';
import { brandThemeVariables } from '../lib/brand-theme';
import { NFI_BRAND_COLOR, NFI_BRAND_COLOR_DARK } from '../lib/nfi-brand';
import { getTenantSlug } from '../lib/tenant';

interface Props {
  onBack: () => void;
  branding?: LoginBranding;
}

export function SignupPage({ onBack, branding }: Props) {
  const hasTenantBranding = Boolean(getTenantSlug());
  const brandStyles = brandThemeVariables(hasTenantBranding ? branding : {
    primaryColor: NFI_BRAND_COLOR,
    accentColor: NFI_BRAND_COLOR_DARK,
  }) as CSSProperties;
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

    // Strict company-email policy: the email's domain must be registered to a
    // workspace, otherwise the account would be created org-less and unusable.
    try {
      const domainRecognized = await emailDomainHasWorkspace(email);
      if (!domainRecognized) {
        setError("This email domain isn't linked to a company workspace. Use your company email address, or ask an existing admin for help.");
        setLoading(false);
        return;
      }
    } catch {
      setError('We could not verify your company workspace. Please try again in a moment.');
      setLoading(false);
      return;
    }

    const consentAcceptedAt = new Date().toISOString();
    const consentUserAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          consent_accepted_at: consentAcceptedAt,
          consent_version: CURRENT_CONSENT_VERSION,
          consent_user_agent: consentUserAgent,
        },
      },
    });

    if (signUpError) {
      setError(mapSignupError(signUpError.message));
      setLoading(false);
      return;
    }

    if (data.user && data.session) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name,
          consent_accepted_at: consentAcceptedAt,
          consent_version: CURRENT_CONSENT_VERSION,
          consent_user_agent: consentUserAgent,
        })
        .eq('id', data.user.id);
      if (profileError) {
        setError('Account created but profile setup failed. Please contact the study administrator.');
        setLoading(false);
        return;
      }
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div className="tenant-auth-form flex min-h-screen items-center justify-center p-6" style={brandStyles}>
        <div className="max-w-md w-full">
          <Card className="border-[var(--brand-border)] shadow-sm">
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <CheckCircle2 className="size-16 text-emerald-600 mx-auto" />
              <h2 className="text-2xl font-bold text-slate-900">Request sent</h2>
              <p className="text-slate-700">Your company email is recognized. An existing admin needs to approve your access before you can enter the workspace.</p>
              <Button onClick={onBack} className="tenant-auth-primary w-full">
                Sign In
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="tenant-auth-form flex min-h-screen items-center justify-center p-6" style={brandStyles}>
      <div className="max-w-md w-full">
        <Card className="border-[var(--brand-border)] shadow-sm">
          <CardHeader className="space-y-2">
            <button
              type="button"
              onClick={onBack}
              className="tenant-auth-link mb-2 inline-flex w-fit items-center gap-1.5 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]/20"
            >
              <ArrowLeft className="size-4" />
              Back to sign in
            </button>
            <div className="flex items-center gap-4">
              <div className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-md bg-white px-2 ring-1 ring-[var(--brand-border)]">
                <TenantOrNfiLogo
                  logoUrl={branding?.logoUrl}
                  organizationName={branding?.workspaceName}
                  tenant={hasTenantBranding}
                  logoClassName="h-9 max-w-36"
                  markSize={36}
                />
              </div>
              <div>
                <CardTitle className="text-2xl">Create Account</CardTitle>
                <p className="text-sm text-slate-700">Request access to {branding?.workspaceName ?? 'your workspace'}</p>
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
                <p className="text-xs text-slate-500">Min 8 characters, one uppercase letter, one number.</p>
              </div>
              <div className="tenant-brand-soft space-y-2 rounded-lg border border-[var(--brand-border)] p-3">
                <p className="text-xs text-slate-700 font-medium">Workspace access terms</p>
                <p className="text-xs text-slate-500">
                  Your name and email will be stored so an existing admin can review your workspace access request.
                </p>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentGiven}
                    onChange={e => setConsentGiven(e.target.checked)}
                    className="mt-0.5"
                    style={{ accentColor: 'var(--brand)' }}
                    required
                  />
                  <span className="text-xs text-slate-700">
                    I agree to the{' '}
                    <a href="/panelist-consent" className="tenant-auth-link font-semibold underline underline-offset-2">Panelist Consent</a>,{' '}
                    <a href="/privacy" className="tenant-auth-link font-semibold underline underline-offset-2">Privacy Policy</a>, and{' '}
                    <a href="/terms" className="tenant-auth-link font-semibold underline underline-offset-2">Terms of Use</a>.
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
                className="tenant-auth-primary w-full"
                disabled={loading || !consentGiven}
              >
                {loading ? 'Creating account…' : 'Create Account'}
              </Button>
              <button
                type="button"
                onClick={onBack}
                className="tenant-auth-link w-full text-sm"
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

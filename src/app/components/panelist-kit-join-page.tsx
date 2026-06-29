import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AlertCircle, CheckCircle2, ClipboardList, HelpCircle, LogIn, PackageCheck, QrCode, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CURRENT_CONSENT_VERSION } from '../lib/database';
import { useAuth } from '../contexts/auth-context';
import { useClaimPanelistKit, useMarkPanelistKitStarted, usePanelistKitInvite, usePanelistKitInviteByManualCode, useReportPanelistKitIssue } from '../lib/hooks';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';

function passwordError(password: string) {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must include at least one number.';
  return null;
}

function storeKitToken(productId: string, token: string) {
  sessionStorage.setItem(`panelist_kit_token_${productId}`, token);
}

function storeManualCode(productId: string, manualCode: string) {
  sessionStorage.setItem(`panelist_kit_manual_code_${productId}`, manualCode);
}

const blockingIssueTypes = new Set(['damaged', 'wrong_code', 'allergy']);

function initialManualCodeFromUrl(token: string) {
  if (token || typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('code')?.trim().toUpperCase() ?? '';
}

export function PanelistKitJoinPage() {
  const { token = '' } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, login, loading } = useAuth();
  const initialManualCode = initialManualCodeFromUrl(token);
  const [manualCodeInput, setManualCodeInput] = useState(initialManualCode);
  const [manualCodeLookup, setManualCodeLookup] = useState(initialManualCode);
  const tokenInvite = usePanelistKitInvite(token || undefined);
  const manualInvite = usePanelistKitInviteByManualCode(manualCodeLookup || undefined);
  const invite = token ? tokenInvite.data : manualInvite.data;
  const isLoading = token ? tokenInvite.isLoading : manualInvite.isLoading;
  const isError = token ? tokenInvite.isError : manualInvite.isError;
  const claimKit = useClaimPanelistKit();
  const markStarted = useMarkPanelistKitStarted();
  const reportIssue = useReportPanelistKitIssue();
  const claimAttemptRef = useRef<string | null>(null);
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [kitReceived, setKitReceived] = useState(false);
  const [codeMatches, setCodeMatches] = useState(false);
  const [safetyAck, setSafetyAck] = useState(false);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issueType, setIssueType] = useState('damaged');
  const [issueNote, setIssueNote] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const activeManualCode = manualCodeLookup || invite?.manualCode || '';
  const claimKey = token || activeManualCode;

  const claimedByThisUser = Boolean(user?.id && invite?.claimedBy === user.id);
  const needsClaim = Boolean(user?.id && invite && !invite.claimedBy);
  const hasBlockingIssue = Boolean(invite?.issueStatus === 'open' && invite.issueType && blockingIssueTypes.has(invite.issueType));
  const canBegin = claimedByThisUser && kitReceived && codeMatches && safetyAck;
  const routeTarget = useMemo(() => {
    if (!invite) return '/panelist';
    return invite.isMultiSample ? `/multi-sample-info/${invite.productId}` : `/questionnaire-info/${invite.productId}`;
  }, [invite]);

  useEffect(() => {
    if (!invite || !user?.id || invite.claimedBy) return;
    if (!claimKey || claimAttemptRef.current === claimKey || claimKit.isPending) return;
    claimAttemptRef.current = claimKey;
    claimKit.mutate({ token: token || null, manualCode: token ? null : activeManualCode });
  }, [activeManualCode, claimKey, claimKit, invite, token, user?.id]);

  const handleManualLookup = (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    setManualCodeLookup(manualCodeInput.trim().toUpperCase());
  };

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!invite) return;
    setMessage('');
    if (!consent) {
      setMessage('Accept the panelist consent terms before creating an account.');
      return;
    }
    const pwError = passwordError(password);
    if (pwError) {
      setMessage(pwError);
      return;
    }
    setBusy(true);
    const acceptedAt = new Date().toISOString();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          org_id: invite.orgId,
          consent_accepted_at: acceptedAt,
          consent_version: CURRENT_CONSENT_VERSION,
          consent_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        },
      },
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    if (!data.session) {
      setMessage('Account created. Check your email to confirm the account, then scan this QR code again to continue.');
    }
  };

  const handleSignin = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    setBusy(true);
    const error = await login(email, password);
    setBusy(false);
    if (error) setMessage(error);
  };

  const handleBegin = async () => {
    if (!invite) return;
    setMessage('');
    try {
      if (token) storeKitToken(invite.productId, token);
      if (activeManualCode) storeManualCode(invite.productId, activeManualCode);
      await markStarted.mutateAsync({ token: token || null, manualCode: token ? null : activeManualCode });
      navigate(routeTarget);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to start this tasting session.');
    }
  };

  const handleReportIssue = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    try {
      await reportIssue.mutateAsync({
        token: token || null,
        manualCode: token ? null : activeManualCode || manualCodeInput,
        issueType,
        issueNote,
      });
      setMessage('Your issue was reported. A study administrator will review it before you taste.');
      setShowIssueForm(false);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to report this kit issue.');
    }
  };

  if (loading || (manualCodeLookup && isLoading) || (token && isLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <p className="text-sm text-slate-500">Loading tasting kit...</p>
      </div>
    );
  }

  if (!token && !invite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <QrCode className="size-5 text-slate-500" />
              Enter your kit code
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-6 text-slate-600">
              Use this if your QR code will not scan. The manual code is printed on your package insert.
            </p>
            <form onSubmit={handleManualLookup} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="manual-kit-code">Manual kit code</Label>
                <Input
                  id="manual-kit-code"
                  placeholder="NFI-8F2K1A3B"
                  value={manualCodeInput}
                  onChange={event => setManualCodeInput(event.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800">Find my kit</Button>
            </form>
            {isError && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>That kit code was not found. Check the insert and try again.</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !invite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <Card className="max-w-md border-rose-200">
          <CardContent className="space-y-3 pt-6">
            <AlertCircle className="size-8 text-rose-600" />
            <h1 className="text-xl font-bold text-slate-950">Kit link not found</h1>
            <p className="text-sm text-slate-600">This QR code is invalid or no longer available. Contact the study administrator.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const unavailable = invite.calculatedStatus === 'expired' || invite.calculatedStatus === 'void' || invite.calculatedStatus === 'submitted';
  const claimedByOther = Boolean(invite.claimedBy && user?.id && invite.claimedBy !== user.id);

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-lg bg-slate-950 p-6 text-white">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
            <QrCode className="size-4" />
            NFI at-home panel
          </div>
          <h1 className="mt-8 text-3xl font-bold tracking-tight">Start your tasting session</h1>
          <p className="mt-3 max-w-sm text-sm leading-6 text-slate-300">
            Confirm your kit, read the safety notes, then complete the ratings while the sample is fresh.
          </p>
          <div className="mt-8 space-y-3 rounded-lg border border-white/10 bg-white/5 p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Study</p>
              <p className="mt-1 font-semibold">{invite.productName}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Kit code</p>
                <p className="mt-1 font-mono text-lg font-bold">{invite.kitCode}</p>
              </div>
              {invite.sampleCode && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Sample code</p>
                  <p className="mt-1 font-mono text-lg font-bold">{invite.sampleCode}</p>
                </div>
              )}
            </div>
            {invite.responseDeadline && (
              <p className="text-sm text-slate-300">Complete by {new Date(invite.responseDeadline).toLocaleDateString()}.</p>
            )}
          </div>
        </section>

        <main className="space-y-4">
          {message && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}
          {unavailable && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>This tasting kit is {invite.calculatedStatus}. Contact the study administrator if this looks wrong.</AlertDescription>
            </Alert>
          )}
          {claimedByOther && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>This kit has already been claimed by another panelist.</AlertDescription>
            </Alert>
          )}
          {hasBlockingIssue && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>
                This kit has an open {invite.issueType?.replace('_', ' ')} issue. Do not taste it until the study administrator confirms what to do next.
              </AlertDescription>
            </Alert>
          )}

          {!user && !unavailable && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <LogIn className="size-5 text-slate-500" />
                  {mode === 'signup' ? 'Create your panelist account' : 'Sign in to continue'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={mode === 'signup' ? handleSignup : handleSignin} className="space-y-4">
                  {mode === 'signup' && (
                    <div className="space-y-1.5">
                      <Label htmlFor="kit-name">Full name</Label>
                      <Input id="kit-name" value={name} onChange={event => setName(event.target.value)} required />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="kit-email">Email</Label>
                    <Input id="kit-email" type="email" value={email} onChange={event => setEmail(event.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="kit-password">Password</Label>
                    <Input id="kit-password" type="password" value={password} onChange={event => setPassword(event.target.value)} required minLength={8} />
                  </div>
                  {mode === 'signup' && (
                    <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                      <input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} className="mt-1 accent-slate-900" />
                      <span>I agree to the panelist consent terms and understand my tasting responses will be used for sensory research.</span>
                    </label>
                  )}
                  <Button type="submit" disabled={busy || (mode === 'signup' && !consent)} className="w-full bg-slate-900 hover:bg-slate-800">
                    {busy ? 'Please wait...' : mode === 'signup' ? 'Create account and claim kit' : 'Sign in and claim kit'}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
                    className="w-full text-sm font-medium text-slate-500 hover:text-slate-900"
                  >
                    {mode === 'signup' ? 'Already have an account? Sign in' : 'Need an account? Create one'}
                  </button>
                </form>
              </CardContent>
            </Card>
          )}

          {user && !unavailable && !claimedByOther && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <PackageCheck className="size-5 text-slate-500" />
                  Confirm before tasting
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {needsClaim || claimKit.isPending ? (
                  <Alert className="border-blue-300 bg-blue-50">
                    <AlertDescription className="text-blue-900">
                      {claimKit.isPending ? 'Claiming your kit...' : 'Your account is ready. Claim this kit to continue.'}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert className="border-emerald-300 bg-emerald-50">
                    <CheckCircle2 className="size-4 text-emerald-600" />
                    <AlertDescription className="text-emerald-800">Kit claimed for {user.name}.</AlertDescription>
                  </Alert>
                )}

                <div className="rounded-lg border border-slate-200 p-4">
                  <button
                    type="button"
                    onClick={() => setShowIssueForm(value => !value)}
                    className="flex w-full items-center justify-between text-left text-sm font-semibold text-slate-900"
                  >
                    <span className="flex items-center gap-2"><HelpCircle className="size-4 text-slate-500" />Problem with my kit</span>
                    <span className="text-xs text-slate-500">{showIssueForm ? 'Close' : 'Report'}</span>
                  </button>
                  {showIssueForm && (
                    <form onSubmit={handleReportIssue} className="mt-3 space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="issue-type">Issue type</Label>
                        <select
                          id="issue-type"
                          value={issueType}
                          onChange={event => setIssueType(event.target.value)}
                          className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900"
                        >
                          <option value="damaged">Package damaged</option>
                          <option value="wrong_code">Wrong kit code</option>
                          <option value="allergy">Allergy or safety concern</option>
                          <option value="cannot_complete">Cannot complete before deadline</option>
                          <option value="signin">Sign-in issue</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="issue-note">Details</Label>
                        <textarea
                          id="issue-note"
                          value={issueNote}
                          onChange={event => setIssueNote(event.target.value)}
                          className="min-h-20 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                          placeholder="Briefly tell us what happened."
                        />
                      </div>
                      <Button type="submit" variant="outline" disabled={reportIssue.isPending}>
                        {reportIssue.isPending ? 'Reporting...' : 'Report issue'}
                      </Button>
                    </form>
                  )}
                </div>

                <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={kitReceived} onChange={event => setKitReceived(event.target.checked)} className="mt-1 accent-slate-900" />
                    <span>I have received this kit and the package is not damaged.</span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={codeMatches} onChange={event => setCodeMatches(event.target.checked)} className="mt-1 accent-slate-900" />
                    <span>The kit code on my insert matches <strong>{invite.kitCode}</strong>.</span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={safetyAck} onChange={event => setSafetyAck(event.target.checked)} className="mt-1 accent-slate-900" />
                    <span>I have checked for allergy or safety concerns and am ready to taste now.</span>
                  </label>
                </div>

                <div className="rounded-lg border border-slate-200 p-4">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <ShieldCheck className="size-4 text-slate-500" />
                    Handling instructions
                  </h2>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{invite.handlingInstructions || 'Follow the instructions included in your tasting kit.'}</p>
                </div>

                <Button onClick={handleBegin} disabled={!canBegin || hasBlockingIssue || markStarted.isPending || claimKit.isPending} className="w-full bg-slate-900 hover:bg-slate-800">
                  <ClipboardList className="size-4" />
                  Begin questionnaire
                </Button>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}

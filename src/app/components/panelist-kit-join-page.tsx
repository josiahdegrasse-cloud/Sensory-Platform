import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AlertCircle, CheckCircle2, ChevronDown, ClipboardList, HelpCircle, Info, KeyRound, LogIn, PackageCheck, QrCode, RefreshCw, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CURRENT_CONSENT_VERSION } from '../lib/database';
import { useAuth } from '../contexts/auth-context';
import { useClaimPanelistKit, useMarkPanelistKitStarted, usePanelistKitInvite, usePanelistKitInviteByManualCode, useReportPanelistKitIssue } from '../lib/hooks';
import { normalizeBoxCode } from '../lib/panelist-box-workflow';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';

function passwordError(password: string) {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must include at least one number.';
  return null;
}

const blockingIssueTypes = new Set(['damaged', 'wrong_code', 'allergy']);

function initialManualCodeFromUrl(token: string) {
  if (token || typeof window === 'undefined') return '';
  return normalizeBoxCode(new URLSearchParams(window.location.search).get('code') ?? '');
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
  const [boxReady, setBoxReady] = useState(false);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issueType, setIssueType] = useState('damaged');
  const [issueNote, setIssueNote] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'error' | 'success' | 'info'>('error');
  const [busy, setBusy] = useState(false);
  const activeManualCode = manualCodeLookup || invite?.manualCode || '';
  const claimKey = token || activeManualCode;

  const claimedByThisUser = Boolean(user?.id && (invite?.claimedByCurrentUser || invite?.claimedBy === user.id));
  const needsClaim = Boolean(user?.id && invite && !claimedByThisUser && !invite.claimedBy);
  const hasBlockingIssue = Boolean(invite?.issueStatus === 'open' && invite.issueType && blockingIssueTypes.has(invite.issueType));
  const canBegin = claimedByThisUser && boxReady;
  const assignedTaskCount = invite?.assignedProductCount ?? 1;
  const reportManualCode = normalizeBoxCode(activeManualCode || manualCodeInput);
  const canReportIssue = Boolean(token || reportManualCode);

  useEffect(() => {
    if (!invite || !user?.id || invite.claimedBy) return;
    if (invite.calculatedStatus === 'claimed' && !invite.claimedByCurrentUser) return;
    if (!claimKey || claimAttemptRef.current === claimKey || claimKit.isPending) return;
    claimAttemptRef.current = claimKey;
    claimKit.mutate(
      { token: token || null, manualCode: token ? null : activeManualCode },
      {
        onError: (err) => {
          setMessageType('error');
          setMessage(err instanceof Error ? err.message : 'Unable to claim this box pass.');
        },
      },
    );
  }, [activeManualCode, claimKey, claimKit, invite, token, user?.id]);

  const handleManualLookup = (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    setManualCodeLookup(normalizeBoxCode(manualCodeInput));
  };

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!invite) return;
    setMessage('');
    if (!consent) {
      setMessageType('error');
      setMessage('Accept the panelist consent terms before creating an account.');
      return;
    }
    const pwError = passwordError(password);
    if (pwError) {
      setMessageType('error');
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
      setMessageType('error');
      setMessage(error.message);
      return;
    }
    if (!data.session) {
      setMessageType('info');
      setMessage(`Account created. Check your email to confirm it, then return to this page. Your box code is ${invite.kitCode}.`);
    }
  };

  const handleSignin = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    setBusy(true);
    const error = await login(email, password);
    setBusy(false);
    if (error) {
      setMessageType('error');
      setMessage(error);
    }
  };

  const handleBegin = async () => {
    if (!invite) return;
    setMessage('');
    try {
      await markStarted.mutateAsync({ token: token || null, manualCode: token ? null : activeManualCode });
      navigate('/panelist');
    } catch (err) {
      setMessageType('error');
      setMessage(err instanceof Error ? err.message : 'Unable to open your task list.');
    }
  };

  const handleReportIssue = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    const manualCode = token ? null : reportManualCode;
    if (!token && !manualCode) {
      setMessageType('error');
      setMessage('Enter the manual box code before reporting this issue.');
      return;
    }
    try {
      await reportIssue.mutateAsync({
        token: token || null,
        manualCode,
        issueType,
        issueNote,
      });
      setMessageType('success');
      setMessage('Your issue was reported. A study administrator will review it before you taste.');
      setShowIssueForm(false);
    } catch (err) {
      setMessageType('error');
      setMessage(err instanceof Error ? err.message : 'Unable to report this box issue.');
    }
  };

  const issuePanel = (
    <section className="rounded-lg border border-slate-200 bg-white p-4" aria-labelledby="box-help-heading">
      <button type="button" onClick={() => setShowIssueForm(value => !value)} className="flex w-full items-center justify-between gap-3 text-left" aria-expanded={showIssueForm}>
        <span><span id="box-help-heading" className="flex items-center gap-2 text-sm font-bold text-slate-900"><HelpCircle className="size-4 text-slate-500" />Something is wrong with my box</span><span className="mt-1 block text-xs text-slate-500">Damage, allergy concern, wrong code, deadline, or sign-in problem</span></span>
        <ChevronDown className={`size-4 shrink-0 text-slate-500 transition-transform ${showIssueForm ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {showIssueForm && (
        <form onSubmit={handleReportIssue} className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          {!token && <div className="space-y-1.5"><Label htmlFor="issue-manual-code">Box code</Label><Input id="issue-manual-code" value={manualCodeInput} onChange={event => setManualCodeInput(normalizeBoxCode(event.target.value))} placeholder="NFI-8F2K1A3B" className="font-mono uppercase" autoCapitalize="characters" spellCheck={false} /></div>}
          <div className="space-y-1.5"><Label htmlFor="issue-type">What happened?</Label><select id="issue-type" value={issueType} onChange={event => setIssueType(event.target.value)} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"><option value="damaged">Package is damaged</option><option value="wrong_code">Box code does not match</option><option value="allergy">Allergy or safety concern</option><option value="cannot_complete">Cannot finish before the deadline</option><option value="signin">Cannot sign in</option><option value="other">Something else</option></select></div>
          <div className="space-y-1.5"><Label htmlFor="issue-note">Tell the study team more</Label><Textarea id="issue-note" value={issueNote} onChange={event => setIssueNote(event.target.value)} className="min-h-20 bg-white text-sm" placeholder="What should the team know?" /></div>
          <Button type="submit" variant="outline" disabled={reportIssue.isPending || !canReportIssue}>{reportIssue.isPending ? 'Sending report…' : 'Send to study team'}</Button>
          {!canReportIssue && <p className="text-xs text-slate-500">Enter the code printed on your insert so the team can find this box.</p>}
        </form>
      )}
    </section>
  );

  if (loading || (manualCodeLookup && isLoading) || (token && isLoading)) return <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><div className="w-full max-w-md space-y-3" aria-label="Loading box pass"><div className="h-7 w-40 animate-pulse rounded bg-slate-200" /><div className="h-36 animate-pulse rounded-lg bg-slate-200" /><div className="h-64 animate-pulse rounded-lg bg-slate-200" /></div></div>;

  if (!token && !invite) return (
    <div className="min-h-screen bg-slate-50 px-4 py-8"><main className="mx-auto max-w-md space-y-5"><div className="flex items-center gap-2 text-sm font-bold text-slate-700"><QrCode className="size-4" />NFI at-home panel</div><section className="rounded-lg border border-slate-200 bg-white p-5"><KeyRound className="size-6 text-slate-600" /><h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-950">Enter the code from your box</h1><p className="mt-2 text-sm leading-6 text-slate-600">Use the short fallback code printed directly below the QR square.</p><form onSubmit={handleManualLookup} className="mt-5 space-y-3"><div className="space-y-1.5"><Label htmlFor="manual-kit-code">Box code</Label><Input id="manual-kit-code" placeholder="NFI-8F2K1A3B" value={manualCodeInput} onChange={event => setManualCodeInput(normalizeBoxCode(event.target.value))} required className="h-11 font-mono uppercase tracking-wide" autoCapitalize="characters" autoCorrect="off" spellCheck={false} /></div><Button type="submit" className="h-11 w-full bg-slate-900 hover:bg-slate-800">Find my box</Button></form>{isError && <Alert variant="destructive" className="mt-4"><AlertCircle className="size-4" /><AlertDescription>We could not find that code. Check each character on the insert and try again.</AlertDescription></Alert>}</section>{issuePanel}</main></div>
  );

  if (isError || !invite) return <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><section className="w-full max-w-md rounded-lg border border-rose-200 bg-white p-5"><AlertCircle className="size-8 text-rose-600" /><h1 className="mt-4 text-2xl font-bold text-slate-950">We cannot open this box pass</h1><p className="mt-2 text-sm leading-6 text-slate-600">The QR may be invalid or no longer active. Use the fallback code on the insert or contact the study team.</p><Button type="button" variant="outline" className="mt-5 w-full" onClick={() => navigate('/join')}>Enter the box code instead</Button></section></div>;

  const unavailable = invite.calculatedStatus === 'expired' || invite.calculatedStatus === 'void' || invite.calculatedStatus === 'submitted';
  const claimedByOther = Boolean(user?.id && !claimedByThisUser && (Boolean(invite.claimedBy && invite.claimedBy !== user.id) || invite.calculatedStatus === 'claimed'));

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:py-10">
      <main className="mx-auto max-w-xl space-y-4">
        <header className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm font-bold text-slate-700"><QrCode className="size-4" />NFI at-home panel</div><span className="font-mono text-xs font-semibold text-slate-500">{invite.kitCode}</span></header>

        <ol className="grid grid-cols-3 gap-2" aria-label="Box setup progress">
          {[['Box found', true], ['Account', Boolean(user)], ['Ready', claimedByThisUser && boxReady]].map(([label, complete], index) => (
            <li key={String(label)} className={`flex items-center gap-2 border-b pb-2 text-xs font-semibold ${complete ? 'border-emerald-600 text-emerald-800' : index === (user ? 2 : 1) ? 'border-slate-900 text-slate-900' : 'border-slate-200 text-slate-400'}`}>
              {complete ? <CheckCircle2 className="size-5 text-emerald-700" /> : <span className="flex size-5 items-center justify-center rounded-full border border-slate-300 text-[10px] text-slate-600">{index + 1}</span>}
              {String(label)}
            </li>
          ))}
        </ol>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-bold text-emerald-800">Box recognized</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">{user ? 'Check your box, then start' : 'Your tasting box is ready'}</h1><p className="mt-2 text-sm leading-6 text-slate-600">{invite.productName} · {assignedTaskCount} assigned tasting task{assignedTaskCount === 1 ? '' : 's'}</p></div><PackageCheck className="size-7 shrink-0 text-emerald-700" aria-hidden /></div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-100 pt-4 text-sm"><span><span className="block text-xs text-slate-500">Box code</span><strong className="font-mono text-slate-900">{invite.kitCode}</strong></span><span><span className="block text-xs text-slate-500">Tasks</span><strong className="text-slate-900">{assignedTaskCount}</strong></span>{invite.responseDeadline && <span><span className="block text-xs text-slate-500">Complete by</span><strong className="text-slate-900">{new Date(invite.responseDeadline).toLocaleDateString()}</strong></span>}</div>
        </section>

        {message && <Alert variant={messageType === 'error' ? 'destructive' : 'default'} className={messageType === 'success' ? 'border-emerald-300 bg-emerald-50' : messageType === 'info' ? 'border-blue-300 bg-blue-50' : undefined}>{messageType === 'success' ? <CheckCircle2 className="size-4 text-emerald-600" /> : messageType === 'info' ? <Info className="size-4 text-blue-600" /> : <AlertCircle className="size-4" />}<AlertDescription className={messageType === 'success' ? 'text-emerald-800' : messageType === 'info' ? 'text-blue-900' : undefined}>{message}</AlertDescription></Alert>}
        {unavailable && <Alert variant="destructive"><AlertCircle className="size-4" /><AlertDescription>This box pass is {invite.calculatedStatus}. Do not taste from it; contact the study team if this seems wrong.</AlertDescription></Alert>}
        {claimedByOther && <Alert variant="destructive"><AlertCircle className="size-4" /><AlertDescription>This box has already been claimed by another panelist. Check the printed code before continuing.</AlertDescription></Alert>}
        {hasBlockingIssue && <Alert variant="destructive"><AlertCircle className="size-4" /><AlertDescription>This box has an open {invite.issueType?.replace('_', ' ')} report. Do not taste anything until the study team responds.</AlertDescription></Alert>}

        {!user && !unavailable && (
          <section className="rounded-lg border border-slate-200 bg-white p-5" aria-labelledby="panelist-account-heading">
            <div className="inline-flex w-full rounded-md bg-slate-100 p-1"><button type="button" onClick={() => setMode('signup')} className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold ${mode === 'signup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}>I’m new</button><button type="button" onClick={() => setMode('signin')} className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold ${mode === 'signin' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}>I have an account</button></div>
            <h2 id="panelist-account-heading" className="mt-5 flex items-center gap-2 text-lg font-bold text-slate-950">{mode === 'signup' ? <LogIn className="size-5 text-slate-500" /> : <KeyRound className="size-5 text-slate-500" />}{mode === 'signup' ? 'Create your panelist account' : 'Sign in to claim this box'}</h2>
            <form onSubmit={mode === 'signup' ? handleSignup : handleSignin} className="mt-4 space-y-4">
              {mode === 'signup' && <div className="space-y-1.5"><Label htmlFor="kit-name">Full name</Label><Input id="kit-name" value={name} onChange={event => setName(event.target.value)} required autoComplete="name" className="h-11" /></div>}
              <div className="space-y-1.5"><Label htmlFor="kit-email">Email</Label><Input id="kit-email" type="email" value={email} onChange={event => setEmail(event.target.value)} required autoComplete="email" className="h-11" /></div>
              <div className="space-y-1.5"><Label htmlFor="kit-password">Password</Label><Input id="kit-password" type="password" value={password} onChange={event => setPassword(event.target.value)} required minLength={8} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} className="h-11" />{mode === 'signup' && <p className="text-xs text-slate-500">8+ characters, including one capital letter and one number.</p>}</div>
              {mode === 'signup' && <label className="flex cursor-pointer items-start gap-3 rounded-md bg-slate-50 p-3 text-sm leading-5 text-slate-700"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} className="mt-1 size-4 accent-slate-900" /><span>I agree to the panelist consent terms and understand that my responses are used for sensory research.</span></label>}
              <Button type="submit" disabled={busy || (mode === 'signup' && !consent)} className="h-11 w-full bg-slate-900 hover:bg-slate-800">{busy ? 'Please wait…' : mode === 'signup' ? 'Create account and claim box' : 'Sign in and claim box'}</Button>
            </form>
          </section>
        )}

        {user && !unavailable && !claimedByOther && (
          <section className="rounded-lg border border-slate-200 bg-white p-5" aria-labelledby="confirm-box-heading">
            <h2 id="confirm-box-heading" className="text-lg font-bold text-slate-950">One safety check</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Signed in as {user.name}. Your tasks will load as soon as you confirm the physical box.</p>
            {needsClaim || claimKit.isPending ? <div className="mt-4 flex items-center gap-2 rounded-md bg-blue-50 p-3 text-sm text-blue-900"><RefreshCw className={`size-4 ${claimKit.isPending ? 'animate-spin' : ''}`} />{claimKit.isPending ? 'Claiming this box…' : 'Connecting this box to your account…'}</div> : <div className="mt-4 flex items-center gap-2 rounded-md bg-emerald-50 p-3 text-sm font-medium text-emerald-900"><CheckCircle2 className="size-4" />Box claimed for {user.name}</div>}
            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-md border border-slate-300 p-4 text-sm leading-6 text-slate-700"><input type="checkbox" checked={boxReady} onChange={event => setBoxReady(event.target.checked)} className="mt-1 size-5 accent-slate-900" /><span><strong className="block text-slate-950">This is my box and it is safe to open</strong>The printed code is {invite.kitCode}, the package is not damaged, and I have no allergy concerns.</span></label>
            <details className="group mt-3 rounded-md bg-slate-50 px-3 py-2.5"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-700"><span className="flex items-center gap-2"><ShieldCheck className="size-4" />Storage and tasting instructions</span><ChevronDown className="size-4 transition-transform group-open:rotate-180" /></summary><p className="mt-3 whitespace-pre-line border-t border-slate-200 pt-3 text-sm leading-6 text-slate-700">{invite.handlingInstructions || 'Follow the instructions included in your tasting box.'}</p></details>
            <Button onClick={handleBegin} disabled={!canBegin || hasBlockingIssue || markStarted.isPending || claimKit.isPending} className="mt-5 h-12 w-full bg-slate-900 text-base hover:bg-slate-800"><ClipboardList className="size-5" />{markStarted.isPending ? 'Opening tasks…' : `See my ${assignedTaskCount} tasting task${assignedTaskCount === 1 ? '' : 's'}`}</Button>
          </section>
        )}

        {issuePanel}
        <p className="pb-4 text-center text-xs leading-5 text-slate-500">Keep the insert until all tasting tasks are complete.</p>
      </main>
    </div>
  );
}

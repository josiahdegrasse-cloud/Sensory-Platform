import { useState } from 'react';
import { CheckCircle2, Mail, Send } from 'lucide-react';
import { useInvitePanelist } from '../lib/hooks';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

export function PanelistInviteForm({ compact = false }: { compact?: boolean }) {
  const invitePanelist = useInvitePanelist();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    setError('');
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    try {
      await invitePanelist.mutateAsync({
        email: normalizedEmail,
        redirectTo: `${window.location.origin}/panelist/profile`,
      });
      setMessage(`Invitation sent to ${normalizedEmail}. They will become available for eligible studies after completing their research, allergy, and delivery profile.`);
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send the invitation.');
    }
  };

  return (
    <div className={compact ? 'space-y-3' : 'rounded-lg border border-slate-200 bg-white p-4'}>
      {!compact && <div className="mb-3 flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-slate-100"><Mail className="size-4 text-slate-700" aria-hidden /></span><div><h3 className="text-sm font-bold text-slate-950">Invite a panelist</h3><p className="mt-0.5 text-xs leading-5 text-slate-600">They create their account and complete the required research, allergy, consent, and delivery profile before they can join a study.</p></div></div>}
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-1.5"><Label htmlFor={compact ? 'box-panelist-email' : 'panelist-invite-email'}>Panelist email</Label><Input id={compact ? 'box-panelist-email' : 'panelist-invite-email'} type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="panelist@example.com" autoComplete="email" required /></div>
        <Button type="submit" disabled={invitePanelist.isPending} className="shrink-0 bg-slate-900 hover:bg-slate-800"><Send className="size-4" aria-hidden />{invitePanelist.isPending ? 'Sending…' : 'Send account invite'}</Button>
      </form>
      {message && <Alert className="mt-3 border-emerald-300 bg-emerald-50"><CheckCircle2 className="size-4 text-emerald-700" /><AlertDescription className="text-emerald-900">{message}</AlertDescription></Alert>}
      {error && <Alert variant="destructive" className="mt-3"><AlertDescription>{error}</AlertDescription></Alert>}
    </div>
  );
}

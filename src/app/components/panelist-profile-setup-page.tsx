import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { CheckCircle2, LockKeyhole, MapPin } from 'lucide-react';
import { useAuth } from '../contexts/auth-context';
import { completePanelistProfile, CURRENT_CONSENT_VERSION } from '../lib/database';
import { supabase } from '../lib/supabase';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

function passwordError(password: string) {
  if (password.length < 8) return 'Use at least 8 characters for your password.';
  if (!/[A-Z]/.test(password)) return 'Add at least one capital letter to your password.';
  if (!/[0-9]/.test(password)) return 'Add at least one number to your password.';
  return null;
}

export function PanelistProfileSetupPage() {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const [name, setName] = useState(user?.name === user?.email ? '' : user?.name ?? '');
  const [phone, setPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('United Kingdom');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!consent) {
      setError('Accept the panelist consent terms to finish your account.');
      return;
    }
    const passwordMessage = passwordError(password);
    if (passwordMessage) {
      setError(passwordMessage);
      return;
    }
    if (password !== confirmPassword) {
      setError('The two passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      const { error: passwordUpdateError } = await supabase.auth.updateUser({ password });
      if (passwordUpdateError) throw passwordUpdateError;
      await completePanelistProfile({
        name,
        phone,
        addressLine1,
        addressLine2,
        city,
        region,
        postalCode,
        country,
        consentVersion: CURRENT_CONSENT_VERSION,
        consentUserAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      });
      await refreshProfile();
      navigate('/panelist', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to finish your account.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-3xl py-4 sm:py-8">
      <header className="mb-6 max-w-2xl">
        <div className="flex size-10 items-center justify-center rounded-lg bg-slate-900 text-white"><MapPin className="size-5" aria-hidden /></div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-950">Finish your panelist account</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Enter the contact and delivery details the study team needs to send tasting boxes. Your invited email cannot be changed here.</p>
      </header>

      <form onSubmit={handleSubmit} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <section className="border-b border-slate-200 p-4 sm:p-6" aria-labelledby="account-details-heading">
          <div className="mb-4"><h2 id="account-details-heading" className="text-base font-bold text-slate-950">Account details</h2><p className="mt-1 text-sm text-slate-600">Use a password you will remember when returning through the QR code.</p></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="profile-email">Invited email</Label><Input id="profile-email" value={user?.email ?? ''} disabled className="bg-slate-50" /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="profile-name">Full name</Label><Input id="profile-name" value={name} onChange={event => setName(event.target.value)} autoComplete="name" required /></div>
            <div className="space-y-1.5"><Label htmlFor="profile-password">Create password</Label><Input id="profile-password" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" required minLength={8} /></div>
            <div className="space-y-1.5"><Label htmlFor="profile-confirm-password">Confirm password</Label><Input id="profile-confirm-password" type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} autoComplete="new-password" required minLength={8} /></div>
          </div>
        </section>

        <section className="border-b border-slate-200 p-4 sm:p-6" aria-labelledby="shipping-details-heading">
          <div className="mb-4"><h2 id="shipping-details-heading" className="text-base font-bold text-slate-950">Contact and delivery</h2><p className="mt-1 text-sm text-slate-600">The study administrator uses this only for panelist coordination and box delivery.</p></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="profile-phone">Phone number</Label><Input id="profile-phone" type="tel" value={phone} onChange={event => setPhone(event.target.value)} autoComplete="tel" required /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="profile-address-1">Address line 1</Label><Input id="profile-address-1" value={addressLine1} onChange={event => setAddressLine1(event.target.value)} autoComplete="address-line1" required /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="profile-address-2">Address line 2 <span className="font-normal text-slate-500">(optional)</span></Label><Input id="profile-address-2" value={addressLine2} onChange={event => setAddressLine2(event.target.value)} autoComplete="address-line2" /></div>
            <div className="space-y-1.5"><Label htmlFor="profile-city">Town or city</Label><Input id="profile-city" value={city} onChange={event => setCity(event.target.value)} autoComplete="address-level2" required /></div>
            <div className="space-y-1.5"><Label htmlFor="profile-region">County or region <span className="font-normal text-slate-500">(optional)</span></Label><Input id="profile-region" value={region} onChange={event => setRegion(event.target.value)} autoComplete="address-level1" /></div>
            <div className="space-y-1.5"><Label htmlFor="profile-postal-code">Postcode</Label><Input id="profile-postal-code" value={postalCode} onChange={event => setPostalCode(event.target.value)} autoComplete="postal-code" required /></div>
            <div className="space-y-1.5"><Label htmlFor="profile-country">Country</Label><Input id="profile-country" value={country} onChange={event => setCountry(event.target.value)} autoComplete="country-name" required /></div>
          </div>
        </section>

        <section className="space-y-4 bg-slate-50 p-4 sm:p-6">
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 bg-white p-3 text-sm leading-5 text-slate-700"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} className="mt-1 size-4 accent-slate-900" /><span>I agree to the <Link to="/panelist-consent" target="_blank" className="font-semibold text-slate-950 underline underline-offset-2">panelist consent terms</Link> and understand how my information and responses are used.</span></label>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs leading-5 text-slate-500"><LockKeyhole className="mr-1 inline size-3.5" aria-hidden />Your profile is visible only to authorized workspace administrators.</p><Button type="submit" disabled={busy} className="bg-slate-900 hover:bg-slate-800"><CheckCircle2 className="size-4" aria-hidden />{busy ? 'Saving account…' : 'Finish account'}</Button></div>
        </section>
      </form>
    </main>
  );
}

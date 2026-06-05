import { useState } from 'react';
import { Link } from 'react-router';
import { ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/auth-context';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';

export function ConsentGate() {
  const { acceptConsent } = useAuth();
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleAccept = async () => {
    setError('');
    setSaving(true);
    const message = await acceptConsent();
    setSaving(false);
    if (message) setError(message);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-slate-900 p-2.5 text-white">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <CardTitle className="text-xl text-slate-900">Panelist consent required</CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                Review and accept the current research data terms before opening questionnaires.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['What we collect', 'Account details, assigned survey activity, sensory ratings, comments, and concept responses.'],
              ['How it is used', 'To run food research, analyze product performance, and improve product development decisions.'],
              ['Your choice', 'Participation is voluntary. You can stop using the platform or contact the study administrator about your data.'],
              ['Data care', 'Access is limited to authorized users for sensory research and administration.'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-sm font-semibold text-slate-900">{title}</div>
                <p className="mt-1 text-xs leading-5 text-slate-600">{body}</p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={checked}
                onChange={event => setChecked(event.target.checked)}
                className="mt-1 accent-slate-900"
              />
              <span className="text-sm leading-6 text-slate-700">
                I have read and agree to the{' '}
                <Link to="/panelist-consent" className="font-semibold text-slate-900 underline underline-offset-2">Panelist Consent</Link>,{' '}
                <Link to="/privacy" className="font-semibold text-slate-900 underline underline-offset-2">Privacy Policy</Link>, and{' '}
                <Link to="/terms" className="font-semibold text-slate-900 underline underline-offset-2">Terms of Use</Link>.
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
            type="button"
            onClick={handleAccept}
            disabled={!checked || saving}
            className="w-full bg-slate-900 hover:bg-slate-700"
          >
            {saving ? 'Saving consent...' : 'Accept and continue'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

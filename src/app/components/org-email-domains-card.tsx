import { useState } from 'react';
import { Globe, Plus, Trash2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Alert, AlertDescription } from './ui/alert';
import { useAuth } from '../contexts/auth-context';
import { useOrgEmailDomains, useAddOrgEmailDomain, useRemoveOrgEmailDomain } from '../lib/hooks';

// Admin manager for the company's sign-in email domains. Anyone signing up
// (password or Google) with an email on one of these domains automatically
// joins this workspace; unknown domains are blocked at signup.
export function OrgEmailDomainsCard() {
  const { user } = useAuth();
  const { data: domains = [], isLoading } = useOrgEmailDomains();
  const addDomain = useAddOrgEmailDomain();
  const removeDomain = useRemoveOrgEmailDomain();
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await addDomain.mutateAsync({ domain: input, actorId: user?.id });
      setInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add domain.');
    }
  };

  const handleRemove = async (domain: string) => {
    setError('');
    try {
      await removeDomain.mutateAsync({ domain, actorId: user?.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to remove domain.');
    }
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Globe className="size-5 text-slate-500" />
          Company sign-in domains
        </CardTitle>
        <p className="text-sm text-slate-500">
          People who sign up with an email on these domains automatically join this workspace.
          Personal providers like gmail.com can't be registered.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleAdd} className="flex gap-2">
          <Input
            value={input}
            onChange={event => setInput(event.target.value)}
            placeholder="acme.com"
            aria-label="Company email domain"
          />
          <Button type="submit" disabled={!input.trim() || addDomain.isPending} className="bg-slate-900 hover:bg-slate-700">
            <Plus className="size-4" />
            {addDomain.isPending ? 'Adding…' : 'Add'}
          </Button>
        </form>

        {error && (
          <Alert variant="destructive" className="py-2.5">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <p className="text-sm text-slate-500">Loading domains…</p>
        ) : domains.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
            No domains registered yet. Until you add one, new people can only join this workspace by invite.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {domains.map(({ domain }) => (
              <li key={domain} className="flex items-center justify-between px-3 py-2">
                <span className="font-mono text-sm text-slate-800">@{domain}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(domain)}
                  disabled={removeDomain.isPending}
                  aria-label={`Remove ${domain}`}
                  className="text-slate-400 hover:text-red-600"
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

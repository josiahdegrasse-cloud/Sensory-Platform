import { useMemo, useState } from 'react';
import { Building2, CheckCircle2, Copy, ExternalLink, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useProvisionPlatformOrganization } from '../lib/hooks';
import type { PlatformOrganizationResult } from '../lib/database';

interface OnboardingDraft {
  organizationName: string;
  organizationSlug: string;
  workspaceName: string;
  administratorEmail: string;
  emailDomains: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
}

const emptyDraft: OnboardingDraft = {
  organizationName: '',
  organizationSlug: '',
  workspaceName: '',
  administratorEmail: '',
  emailDomains: '',
  logoUrl: '',
  primaryColor: '#0f172a',
  accentColor: '#2563eb',
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

export function PlatformOrganizationOnboarding() {
  const provision = useProvisionPlatformOrganization();
  const [draft, setDraft] = useState(emptyDraft);
  const [result, setResult] = useState<PlatformOrganizationResult | null>(null);
  const [copied, setCopied] = useState(false);

  const domains = useMemo(() => draft.emailDomains
    .split(',')
    .map(domain => domain.trim().toLowerCase())
    .filter(Boolean), [draft.emailDomains]);

  const update = (key: keyof OnboardingDraft, value: string) => {
    setDraft(previous => ({ ...previous, [key]: value }));
  };

  const updateName = (value: string) => {
    setDraft(previous => ({
      ...previous,
      organizationName: value,
      organizationSlug: previous.organizationSlug === slugify(previous.organizationName)
        ? slugify(value)
        : previous.organizationSlug,
      workspaceName: !previous.workspaceName || previous.workspaceName === `${previous.organizationName} Sensory Workspace`
        ? `${value} Sensory Workspace`
        : previous.workspaceName,
    }));
  };

  const submit = async () => {
    setResult(null);
    try {
      const created = await provision.mutateAsync({
        organizationName: draft.organizationName.trim(),
        organizationSlug: draft.organizationSlug.trim(),
        workspaceName: draft.workspaceName.trim(),
        administratorEmail: draft.administratorEmail.trim(),
        emailDomains: domains,
        logoUrl: draft.logoUrl.trim(),
        primaryColor: draft.primaryColor,
        accentColor: draft.accentColor,
      });
      setResult(created);
    } catch {
      // The mutation exposes its normalized database error in the form below.
    }
  };

  const copySignInUrl = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.signInUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const canSubmit = draft.organizationName.trim().length >= 2
    && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(draft.organizationSlug)
    && draft.administratorEmail.includes('@')
    && domains.includes(draft.administratorEmail.split('@')[1]?.trim().toLowerCase() ?? '');

  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="size-5 text-slate-500" />
            Create a client workspace
          </CardTitle>
          <CardDescription>
            Creates the tenant, branded sign-in address, workspace defaults, company domains, and first administrator in one transaction.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="client-organization-name">Company name</Label>
            <Input id="client-organization-name" value={draft.organizationName} onChange={event => updateName(event.target.value)} placeholder="Acme Foods" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-organization-slug">Subdomain</Label>
            <Input id="client-organization-slug" value={draft.organizationSlug} onChange={event => update('organizationSlug', slugify(event.target.value))} placeholder="acme-foods" />
            <p className="text-xs text-slate-500">{draft.organizationSlug || 'company'}.your-root-domain.com</p>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="client-workspace-name">Workspace name</Label>
            <Input id="client-workspace-name" value={draft.workspaceName} onChange={event => update('workspaceName', event.target.value)} placeholder="Acme Foods Sensory Workspace" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-admin-email">First administrator</Label>
            <Input id="client-admin-email" type="email" value={draft.administratorEmail} onChange={event => update('administratorEmail', event.target.value)} placeholder="research@acmefoods.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-email-domains">Company email domains</Label>
            <Input id="client-email-domains" value={draft.emailDomains} onChange={event => update('emailDomains', event.target.value)} placeholder="acmefoods.com, acme.co.uk" />
            <p className="text-xs text-slate-500">Comma-separated. The first administrator’s domain must be included.</p>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="client-logo-url">Logo URL <span className="font-normal text-slate-400">optional</span></Label>
            <Input id="client-logo-url" type="url" value={draft.logoUrl} onChange={event => update('logoUrl', event.target.value)} placeholder="https://cdn.example.com/logo.svg" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-primary-color">Primary color</Label>
            <div className="flex gap-2">
              <Input id="client-primary-color-picker" aria-label="Choose primary color" className="w-14 p-1" type="color" value={draft.primaryColor} onChange={event => update('primaryColor', event.target.value)} />
              <Input id="client-primary-color" value={draft.primaryColor} onChange={event => update('primaryColor', event.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-accent-color">Accent color</Label>
            <div className="flex gap-2">
              <Input id="client-accent-color-picker" aria-label="Choose accent color" className="w-14 p-1" type="color" value={draft.accentColor} onChange={event => update('accentColor', event.target.value)} />
              <Input id="client-accent-color" value={draft.accentColor} onChange={event => update('accentColor', event.target.value)} />
            </div>
          </div>
          <div className="md:col-span-2">
            <Button onClick={() => void submit()} disabled={!canSubmit || provision.isPending} className="bg-slate-900 hover:bg-slate-700">
              <ShieldCheck className="size-4" />
              {provision.isPending ? 'Creating workspace…' : 'Create client workspace'}
            </Button>
          </div>
          {provision.error && (
            <Alert variant="destructive" className="md:col-span-2">
              <AlertDescription>{provision.error.message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Handoff</CardTitle>
          <CardDescription>The customer completes account creation at their branded address.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {result ? (
            <>
              <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
                <CheckCircle2 className="size-4" />
                <AlertDescription>{result.organizationSlug} is ready for its first administrator.</AlertDescription>
              </Alert>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                <p className="font-semibold text-slate-900">Send this sign-in address to</p>
                <p className="mt-1 text-slate-600">{result.administratorEmail}</p>
                <p className="mt-3 break-all font-medium text-slate-900">{result.signInUrl}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => void copySignInUrl()}>
                    <Copy className="size-4" />{copied ? 'Copied' : 'Copy link'}
                  </Button>
                  <Button type="button" variant="outline" size="sm" asChild>
                    <a href={result.signInUrl} target="_blank" rel="noreferrer"><ExternalLink className="size-4" />Open</a>
                  </Button>
                </div>
              </div>
              <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-600">
                <li>The named administrator creates an account with the exact email above.</li>
                <li>The one-use bootstrap grant makes that account the workspace admin.</li>
                <li>They can then invite panelists and manage additional admins normally.</li>
              </ol>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm leading-6 text-slate-500">
              The customer handoff link and first-admin instructions will appear here after the workspace is created.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

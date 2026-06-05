import { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertCircle, CheckCircle2, Clock, Database, KeyRound, Save,
  Settings, ShieldCheck, UserCheck, UserX, Users,
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Alert, AlertDescription } from './ui/alert';
import {
  useAuditEvents,
  useConceptGenerationSettings,
  usePanelists,
  useUpdatePanelistStatus,
  useUpdateWorkspaceSettings,
  useWorkspaceSettings,
} from '../lib/hooks';
import type { WorkspaceSettings, PanelistInfo } from '../lib/database';
import { useAuth } from '../contexts/auth-context';

const fallbackSettings: WorkspaceSettings = {
  workspaceName: 'Sensory Analysis Workspace',
  organizationName: 'New Food Innovation',
  adminContactEmail: '',
  defaultTimezone: 'America/New_York',
  dataRetentionMonths: 24,
  requirePanelistConsent: true,
  allowSelfSignup: true,
  updatedAt: null,
};

function StatusBadge({ status }: { status: PanelistInfo['status'] }) {
  const className = status === 'active'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : status === 'inactive'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-slate-200 bg-slate-100 text-slate-600';
  return <Badge variant="outline" className={className}>{status}</Badge>;
}

function formatEventType(value: string) {
  return value.split('_').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function formatMetadata(metadata: Record<string, unknown>) {
  const entries = Object.entries(metadata);
  if (entries.length === 0) return 'No details';
  return entries
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`)
    .join(' · ');
}

export function AdminSettings() {
  const { user } = useAuth();
  const { data: settings = fallbackSettings, isLoading: settingsLoading } = useWorkspaceSettings();
  const { data: panelists = [] } = usePanelists();
  const { data: auditEvents = [] } = useAuditEvents();
  const { data: conceptSettings } = useConceptGenerationSettings();
  const updateSettings = useUpdateWorkspaceSettings();
  const updatePanelistStatus = useUpdatePanelistStatus();
  const [draft, setDraft] = useState<WorkspaceSettings>(settings);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const panelistStats = useMemo(() => {
    const active = panelists.filter(panelist => panelist.status === 'active').length;
    const inactive = panelists.filter(panelist => panelist.status !== 'active').length;
    const consented = panelists.filter(panelist => !!panelist.consentAcceptedAt).length;
    return { active, inactive, consented };
  }, [panelists]);

  const saveSettings = async () => {
    setError('');
    setSaved(false);
    try {
      await updateSettings.mutateAsync({ settings: draft, actorId: user?.id });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2600);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save settings.');
    }
  };

  const togglePanelistStatus = async (panelist: PanelistInfo) => {
    const nextStatus = panelist.status === 'active' ? 'inactive' : 'active';
    await updatePanelistStatus.mutateAsync({ userId: panelist.id, status: nextStatus, actorId: user?.id });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Settings</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Manage workspace identity, panelist access, consent controls, and operational history.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>{panelistStats.active} active panelists</span>
          <span className="text-slate-300">/</span>
          <span>{panelistStats.consented} consent records</span>
          <span className="text-slate-300">/</span>
          <span>{auditEvents.length} recent audit events</span>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {saved && (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
          <CheckCircle2 className="size-4" />
          <AlertDescription>Workspace settings saved.</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="workspace" className="gap-4">
        <TabsList className="rounded-lg">
          <TabsTrigger value="workspace"><Settings className="size-4" />Workspace</TabsTrigger>
          <TabsTrigger value="users"><Users className="size-4" />Users</TabsTrigger>
          <TabsTrigger value="audit"><Activity className="size-4" />Audit log</TabsTrigger>
        </TabsList>

        <TabsContent value="workspace" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Database className="size-5 text-slate-500" />
                  Workspace controls
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="workspace-name">Workspace name</Label>
                    <Input
                      id="workspace-name"
                      value={draft.workspaceName}
                      onChange={event => setDraft(prev => ({ ...prev, workspaceName: event.target.value }))}
                      disabled={settingsLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="organization-name">Organization</Label>
                    <Input
                      id="organization-name"
                      value={draft.organizationName}
                      onChange={event => setDraft(prev => ({ ...prev, organizationName: event.target.value }))}
                      disabled={settingsLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-email">Admin contact email</Label>
                    <Input
                      id="contact-email"
                      type="email"
                      value={draft.adminContactEmail}
                      onChange={event => setDraft(prev => ({ ...prev, adminContactEmail: event.target.value }))}
                      placeholder="research@company.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Default timezone</Label>
                    <Input
                      id="timezone"
                      value={draft.defaultTimezone}
                      onChange={event => setDraft(prev => ({ ...prev, defaultTimezone: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="retention">Data retention months</Label>
                    <Input
                      id="retention"
                      type="number"
                      min={1}
                      max={120}
                      value={draft.dataRetentionMonths}
                      onChange={event => setDraft(prev => ({ ...prev, dataRetentionMonths: Number(event.target.value) }))}
                    />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">Require panelist consent</span>
                      <span className="text-xs text-slate-500">Gate questionnaires until consent is accepted.</span>
                    </span>
                    <Switch
                      checked={draft.requirePanelistConsent}
                      onCheckedChange={checked => setDraft(prev => ({ ...prev, requirePanelistConsent: checked }))}
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">Allow self signup</span>
                      <span className="text-xs text-slate-500">Let new panelists create accounts from sign in.</span>
                    </span>
                    <Switch
                      checked={draft.allowSelfSignup}
                      onCheckedChange={checked => setDraft(prev => ({ ...prev, allowSelfSignup: checked }))}
                    />
                  </label>
                </div>

                <Button onClick={saveSettings} disabled={updateSettings.isPending} className="bg-slate-900 hover:bg-slate-700">
                  <Save className="size-4" />
                  {updateSettings.isPending ? 'Saving...' : 'Save settings'}
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <KeyRound className="size-5 text-slate-500" />
                    AI generation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Image count</span>
                    <span className="font-semibold text-slate-900">{conceptSettings?.defaultImageCount ?? 4}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Quality</span>
                    <Badge variant="outline" className="capitalize">{conceptSettings?.defaultQuality ?? 'medium'}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Prompt style</span>
                    <span className="font-semibold capitalize text-slate-900">{conceptSettings?.promptStyle ?? 'balanced'}</span>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                    OpenAI keys stay in Supabase secrets. This page shows operational defaults, not secret values.
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ShieldCheck className="size-5 text-slate-500" />
                    Compliance snapshot
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Consent version</span>
                    <span className="font-semibold text-slate-900">2026-06-05-v1</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Inactive panelists</span>
                    <span className="font-semibold text-slate-900">{panelistStats.inactive}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Last settings update</span>
                    <span className="font-semibold text-slate-900">
                      {settings.updatedAt ? new Date(settings.updatedAt).toLocaleDateString() : 'Not saved yet'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="users">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="size-5 text-slate-500" />
                  Panelist roster
                </CardTitle>
                <p className="mt-1 text-sm text-slate-500">Track consent, survey completions, and account availability.</p>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Panelist</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Consent</TableHead>
                    <TableHead>Training</TableHead>
                    <TableHead className="text-right">Completed</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {panelists.map(panelist => (
                    <TableRow key={panelist.id}>
                      <TableCell>
                        <div className="font-semibold text-slate-900">{panelist.name}</div>
                        <div className="text-xs text-slate-500">{panelist.email ?? panelist.panelistId ?? panelist.id}</div>
                      </TableCell>
                      <TableCell><StatusBadge status={panelist.status} /></TableCell>
                      <TableCell>
                        {panelist.consentAcceptedAt ? (
                          <div className="flex items-center gap-2 text-sm text-emerald-700">
                            <UserCheck className="size-4" />
                            {new Date(panelist.consentAcceptedAt).toLocaleDateString()}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-sm text-amber-700">
                            <Clock className="size-4" />
                            Pending
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="capitalize">{panelist.trainingLevel}</TableCell>
                      <TableCell className="text-right font-semibold">{panelist.completedCount}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => togglePanelistStatus(panelist)}
                          disabled={updatePanelistStatus.isPending}
                        >
                          {panelist.status === 'active' ? <UserX className="size-4" /> : <UserCheck className="size-4" />}
                          {panelist.status === 'active' ? 'Deactivate' : 'Activate'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {panelists.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-slate-500">
                        No panelists yet. New accounts will appear here after signup.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="size-5 text-slate-500" />
                Audit trail
              </CardTitle>
              <p className="text-sm text-slate-500">Recent operational events captured from imports, settings, and account changes.</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {auditEvents.map(event => (
                  <div key={event.id} className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">{formatEventType(event.eventType)}</span>
                        <Badge variant="outline">{event.entityType}</Badge>
                      </div>
                      <p className="mt-1 truncate text-sm text-slate-500">{formatMetadata(event.metadata)}</p>
                      <p className="mt-2 text-xs text-slate-400">
                        {event.actorName ? `By ${event.actorName}` : 'System or unknown actor'}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-xs text-slate-500">
                      {new Date(event.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
                {auditEvents.length === 0 && (
                  <div className="rounded-lg border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500">
                    Audit events will appear after imports, settings updates, and account changes.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

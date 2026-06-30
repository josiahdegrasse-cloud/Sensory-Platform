import { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertCircle, Brain, CheckCircle2, ClipboardCheck, Database,
  HardDrive, Lock, Palette, Save, UserCheck, UserX, Users,
} from 'lucide-react';
import { BrandingSettings } from './branding-settings';
import { OrgEmailDomainsCard } from './org-email-domains-card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
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
import { parseDriveFolderId } from '../lib/database';
import { useAuth } from '../contexts/auth-context';

const fallbackSettings: WorkspaceSettings = {
  workspaceName: 'Sensory Analysis Workspace',
  organizationName: 'New Food Innovation',
  adminContactEmail: '',
  defaultTimezone: 'America/New_York',
  dataRetentionMonths: 24,
  requirePanelistConsent: true,
  allowSelfSignup: true,
  defaultPanelSize: 24,
  requireHedonicSection: true,
  requireIntensitySection: true,
  requireEmotionSection: true,
  allowPanelistComments: true,
  requireAllSamplesBeforeSubmit: true,
  autoCreateFoodTypes: true,
  autoCreateSurveysFromImports: true,
  requireImportReview: false,
  duplicateSamplePolicy: 'skip',
  requirePanelistId: false,
  allowPanelistsViewHistory: false,
  inactivePanelistDays: 90,
  conceptMaxGenerationsPerConcept: 12,
  conceptMonthlyBudgetCents: 2500,
  conceptRequireApproval: false,
  decisionGoThreshold: 75,
  decisionStopThreshold: 45,
  decisionMinResponses: 12,
  decisionLockConfirmed: true,
  anonymizePanelistsInReports: true,
  exportFormat: 'xlsx',
  reportFooter: '',
  reportTone: 'standard',
  defaultReportTitle: '',
  reportTemplate: 'editorial-sage',
  notifyOnImport: true,
  notifyOnCompletionTarget: true,
  notifyOnGenerationFailure: true,
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
  return entries.slice(0, 4).map(([key, value]) =>
    `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`
  ).join(' · ');
}

function ToggleRow({ title, detail, checked, onChange }: {
  title: string;
  detail: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = `setting-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4">
      <Label htmlFor={id} className="min-w-0">
        <span className="block text-sm font-semibold text-slate-900">{title}</span>
        <span className="text-xs leading-5 text-slate-500">{detail}</span>
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} aria-label={title} />
    </div>
  );
}

function NumberField({ id, label, value, min, max, onChange, suffix }: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          aria-label={label}
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={event => onChange(Number(event.target.value))}
        />
        {suffix && <span className="text-xs text-slate-500">{suffix}</span>}
      </div>
    </div>
  );
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
  // Raw text for the Drive folder field so typing a URL by hand isn't blanked
  // by parse-on-keystroke; the parsed id is committed to the draft on blur.
  const [driveFolderInput, setDriveFolderInput] = useState(settings.driveFolderId ?? '');

  useEffect(() => {
    setDraft(settings);
    setDriveFolderInput(settings.driveFolderId ?? '');
  }, [settings]);

  const commitDriveFolder = () => {
    const folderId = parseDriveFolderId(driveFolderInput);
    setDraft(prev => ({
      ...prev,
      driveFolderId: folderId,
      // Best-effort label: keep an existing name, else derive nothing (id shown).
      driveFolderName: folderId ? (prev.driveFolderName ?? null) : null,
    }));
    // Normalise the visible text to the parsed id once it resolves.
    if (folderId) setDriveFolderInput(folderId);
  };

  const panelistStats = useMemo(() => {
    const active = panelists.filter(panelist => panelist.status === 'active').length;
    const consented = panelists.filter(panelist => !!panelist.consentAcceptedAt).length;
    return { active, consented };
  }, [panelists]);

  const updateDraft = <K extends keyof WorkspaceSettings>(key: K, value: WorkspaceSettings[K]) => {
    setDraft(prev => ({ ...prev, [key]: value }));
  };

  const saveSettings = async () => {
    setError('');
    setSaved(false);
    try {
      // Parse the Drive folder from its raw input here so an un-blurred edit is
      // never lost when Save is clicked directly.
      const driveFolderId = parseDriveFolderId(driveFolderInput);
      const finalSettings: WorkspaceSettings = {
        ...draft,
        driveFolderId,
        driveFolderName: driveFolderId ? (draft.driveFolderName ?? null) : null,
      };
      await updateSettings.mutateAsync({ settings: finalSettings, actorId: user?.id });
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
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Settings</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Set the rules that shape imports, studies, panelist access, concept generation, and reports.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{panelistStats.active} active panelists</span>
            <span className="text-slate-300">/</span>
            <span>{panelistStats.consented} consent records</span>
            <span className="text-slate-300">/</span>
            <span>{auditEvents.length} recent audit events</span>
          </div>
        </div>
        <Button onClick={saveSettings} disabled={updateSettings.isPending} className="w-fit bg-slate-900 hover:bg-slate-700">
          <Save className="size-4" />
          {updateSettings.isPending ? 'Saving...' : 'Save settings'}
        </Button>
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

      <Tabs defaultValue="study" className="gap-4">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-lg p-1 sm:inline-flex sm:w-fit sm:grid-cols-none">
          <TabsTrigger className="h-10 justify-start sm:h-8 sm:justify-center" value="study"><ClipboardCheck className="size-4" />Study setup</TabsTrigger>
          <TabsTrigger className="h-10 justify-start sm:h-8 sm:justify-center" value="access"><Users className="size-4" />Access</TabsTrigger>
          <TabsTrigger className="h-10 justify-start sm:h-8 sm:justify-center" value="automation"><Database className="size-4" />Automation</TabsTrigger>
          <TabsTrigger className="h-10 justify-start sm:h-8 sm:justify-center" value="decision"><Brain className="size-4" />Decision</TabsTrigger>
          <TabsTrigger className="h-10 justify-start sm:h-8 sm:justify-center" value="branding"><Palette className="size-4" />Branding</TabsTrigger>
          <TabsTrigger className="h-10 justify-start sm:h-8 sm:justify-center" value="audit"><Activity className="size-4" />Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="study">
          <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader><CardTitle className="text-lg">Workspace identity</CardTitle></CardHeader>
              <CardContent className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="workspace-name">Workspace name</Label>
                  <Input id="workspace-name" aria-label="Workspace name" value={draft.workspaceName} onChange={event => updateDraft('workspaceName', event.target.value)} disabled={settingsLoading} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="organization-name">Organization</Label>
                  <Input id="organization-name" aria-label="Organization" value={draft.organizationName} onChange={event => updateDraft('organizationName', event.target.value)} disabled={settingsLoading} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-email">Admin contact email</Label>
                  <Input id="contact-email" aria-label="Admin contact email" type="email" value={draft.adminContactEmail} onChange={event => updateDraft('adminContactEmail', event.target.value)} placeholder="research@company.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Default timezone</Label>
                  <Input id="timezone" aria-label="Default timezone" value={draft.defaultTimezone} onChange={event => updateDraft('defaultTimezone', event.target.value)} />
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardHeader><CardTitle className="text-lg">Questionnaire defaults</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <NumberField id="default-panel-size" label="Default response target" value={draft.defaultPanelSize} min={1} max={500} onChange={value => updateDraft('defaultPanelSize', value)} />
                <ToggleRow title="Require liking section" detail="Include hedonic liking questions in new product surveys." checked={draft.requireHedonicSection} onChange={checked => updateDraft('requireHedonicSection', checked)} />
                <ToggleRow title="Require intensity section" detail="Include sensory intensity scales in new product surveys." checked={draft.requireIntensitySection} onChange={checked => updateDraft('requireIntensitySection', checked)} />
                <ToggleRow title="Require emotions section" detail="Ask panelists how the sample made them feel after tasting." checked={draft.requireEmotionSection} onChange={checked => updateDraft('requireEmotionSection', checked)} />
                <ToggleRow title="Allow panelist comments" detail="Let panelists add free-text notes before submitting." checked={draft.allowPanelistComments} onChange={checked => updateDraft('allowPanelistComments', checked)} />
                <ToggleRow title="Require every assigned sample" detail="Prevent submission until all samples in the study are completed." checked={draft.requireAllSamplesBeforeSubmit} onChange={checked => updateDraft('requireAllSamplesBeforeSubmit', checked)} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="access">
          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.4fr]">
            <div className="space-y-4">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader><CardTitle className="text-lg">Panelist access rules</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <ToggleRow title="Allow self signup" detail="Show the create-account option on the sign-in page." checked={draft.allowSelfSignup} onChange={checked => updateDraft('allowSelfSignup', checked)} />
                  <ToggleRow title="Require panelist consent" detail="Gate questionnaires until consent is accepted." checked={draft.requirePanelistConsent} onChange={checked => updateDraft('requirePanelistConsent', checked)} />
                  <ToggleRow title="Require panelist IDs" detail="Use internal panelist IDs as required roster metadata." checked={draft.requirePanelistId} onChange={checked => updateDraft('requirePanelistId', checked)} />
                  <ToggleRow title="Show panelist history" detail="Allow panelists to see their previously completed questionnaires." checked={draft.allowPanelistsViewHistory} onChange={checked => updateDraft('allowPanelistsViewHistory', checked)} />
                  <NumberField id="inactive-panelist-days" label="Mark inactive after" value={draft.inactivePanelistDays} min={1} max={730} suffix="days" onChange={value => updateDraft('inactivePanelistDays', value)} />
                </CardContent>
              </Card>
              <OrgEmailDomainsCard />
            </div>
            <PanelistTable panelists={panelists} updating={updatePanelistStatus.isPending} onToggleStatus={togglePanelistStatus} />
          </div>
        </TabsContent>

        <TabsContent value="automation">
          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Database className="size-5 text-slate-500" />Import rules</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <ToggleRow title="Auto-create food types" detail="New CSV food categories become food type folders." checked={draft.autoCreateFoodTypes} onChange={checked => updateDraft('autoCreateFoodTypes', checked)} />
                <ToggleRow title="Auto-create surveys" detail="Imported machine samples become panelist-ready questionnaires." checked={draft.autoCreateSurveysFromImports} onChange={checked => updateDraft('autoCreateSurveysFromImports', checked)} />
                <ToggleRow title="Require import review" detail="Hold generated surveys for admin review before launch." checked={draft.requireImportReview} onChange={checked => updateDraft('requireImportReview', checked)} />
                <div className="space-y-2">
                  <Label>Duplicate sample policy</Label>
                  <Select value={draft.duplicateSamplePolicy} onValueChange={value => updateDraft('duplicateSamplePolicy', value as WorkspaceSettings['duplicateSamplePolicy'])}>
                    <SelectTrigger aria-label="Duplicate sample policy"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="skip">Skip duplicate sample</SelectItem>
                      <SelectItem value="rename">Rename as a new run</SelectItem>
                      <SelectItem value="replace">Replace existing sample</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 border-t border-slate-100 pt-4">
                  <Label htmlFor="drive-folder" className="flex items-center gap-1.5">
                    <HardDrive className="size-4 text-slate-500" />
                    Google Drive folder
                  </Label>
                  <Input
                    id="drive-folder"
                    aria-label="Google Drive folder"
                    value={driveFolderInput}
                    placeholder="Paste a Drive folder link or ID"
                    onChange={event => setDriveFolderInput(event.target.value)}
                    onBlur={commitDriveFolder}
                  />
                  <p className="text-xs leading-5 text-slate-500">
                    Connect a shared folder, then use <span className="font-medium">Sync from Drive</span> on the
                    Instruments page to pull in CSVs. You'll need to share the folder with the service-account
                    email shown in the sync dialog (Viewer access).
                    {draft.driveFolderId
                      ? <span className="mt-1 block text-emerald-700">Connected · folder {draft.driveFolderId}</span>
                      : <span className="mt-1 block text-slate-400">No folder connected yet.</span>}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><KeyRoundIcon />Concept Lab limits</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <NumberField id="concept-generations" label="Max generations per concept" value={draft.conceptMaxGenerationsPerConcept} min={1} max={100} onChange={value => updateDraft('conceptMaxGenerationsPerConcept', value)} />
                <NumberField id="concept-budget" label="Monthly image budget" value={Math.round(draft.conceptMonthlyBudgetCents / 100)} min={0} max={10000} suffix="USD" onChange={value => updateDraft('conceptMonthlyBudgetCents', value * 100)} />
                <ToggleRow title="Require image approval" detail="Generated images need admin approval before being used in a concept survey." checked={draft.conceptRequireApproval} onChange={checked => updateDraft('conceptRequireApproval', checked)} />
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                  Current image default: {conceptSettings?.defaultImageCount ?? 4} images at {conceptSettings?.defaultQuality ?? 'medium'} quality. Secret API keys stay in Supabase.
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="decision">
          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Brain className="size-5 text-slate-500" />Go / Tweak / Stop rules</CardTitle></CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <NumberField id="stop-threshold" label="STOP below" value={draft.decisionStopThreshold} min={0} max={99} suffix="score" onChange={value => updateDraft('decisionStopThreshold', value)} />
                <NumberField id="go-threshold" label="GO at or above" value={draft.decisionGoThreshold} min={1} max={100} suffix="score" onChange={value => updateDraft('decisionGoThreshold', value)} />
                <NumberField id="min-responses" label="Minimum responses" value={draft.decisionMinResponses} min={1} max={500} onChange={value => updateDraft('decisionMinResponses', value)} />
              </CardContent>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardHeader><CardTitle className="text-lg">Governance</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <ToggleRow title="Lock confirmed decisions" detail="Prevent confirmed GO/TWEAK/STOP records from being silently changed after approval." checked={draft.decisionLockConfirmed} onChange={checked => updateDraft('decisionLockConfirmed', checked)} />
                <ToggleRow title="Anonymize panelists in reports" detail="Use panelist IDs or aggregate labels instead of names in report exports." checked={draft.anonymizePanelistsInReports} onChange={checked => updateDraft('anonymizePanelistsInReports', checked)} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="branding">
          <BrandingSettings draft={draft} updateDraft={updateDraft} disabled={settingsLoading} />
        </TabsContent>

        <TabsContent value="audit"><AuditLog auditEvents={auditEvents} /></TabsContent>
      </Tabs>
    </div>
  );
}

function KeyRoundIcon() {
  return <Lock className="size-5 text-slate-500" />;
}

function PanelistTable({ panelists, updating, onToggleStatus }: {
  panelists: PanelistInfo[];
  updating: boolean;
  onToggleStatus: (panelist: PanelistInfo) => void;
}) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><Users className="size-5 text-slate-500" />Panelist roster</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table className="min-w-[680px]">
            <TableHeader>
              <TableRow>
                <TableHead>Panelist</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Consent</TableHead>
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
                      <div className="flex items-center gap-2 text-sm text-emerald-700"><UserCheck className="size-4" />{new Date(panelist.consentAcceptedAt).toLocaleDateString()}</div>
                    ) : (
                      <span className="text-sm text-amber-700">Pending</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold">{panelist.completedCount}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => onToggleStatus(panelist)} disabled={updating}>
                      {panelist.status === 'active' ? <UserX className="size-4" /> : <UserCheck className="size-4" />}
                      {panelist.status === 'active' ? 'Deactivate' : 'Activate'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {panelists.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-10 text-center text-slate-500">No panelists yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function AuditLog({ auditEvents }: { auditEvents: ReturnType<typeof useAuditEvents>['data'] }) {
  const events = auditEvents ?? [];
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><Activity className="size-5 text-slate-500" />Audit trail</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {events.map(event => (
            <div key={event.id} className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-900">{formatEventType(event.eventType)}</span>
                  <Badge variant="outline">{event.entityType}</Badge>
                </div>
                <p className="mt-1 truncate text-sm text-slate-500">{formatMetadata(event.metadata)}</p>
                <p className="mt-2 text-xs text-slate-400">{event.actorName ? `By ${event.actorName}` : 'System or unknown actor'}</p>
              </div>
              <div className="shrink-0 text-right text-xs text-slate-500">{new Date(event.createdAt).toLocaleString()}</div>
            </div>
          ))}
          {events.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500">
              Audit events will appear after imports, settings updates, and account changes.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

import { AlertTriangle, Palette, Star } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import type { WorkspaceSettings } from '../lib/database';

const DEFAULT_PRIMARY = '#2563eb'; // blue-600, the platform accent

/** WCAG relative-luminance contrast of a hex color against white. */
export function contrastVsWhite(hex: string): number | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const [r, g, b] = [0, 2, 4].map(offset => {
    const channel = parseInt(match[1].slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (1 + 0.05) / (luminance + 0.05);
}

function ColorField({ id, label, value, onChange, disabled }: {
  id: string;
  label: string;
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}) {
  const current = value ?? '';
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={/^#[0-9a-f]{6}$/i.test(current) ? current : DEFAULT_PRIMARY}
          onChange={event => onChange(event.target.value)}
          disabled={disabled}
          className="size-9 shrink-0 cursor-pointer rounded-md border border-slate-200 bg-white p-1"
        />
        <Input
          id={id}
          value={current}
          onChange={event => onChange(event.target.value.trim() || null)}
          placeholder="Platform default"
          disabled={disabled}
          className="font-mono"
        />
      </div>
    </div>
  );
}

/**
 * Per-tenant branding: identity (logo, colors) and report voice. Brand color
 * is allowed on actions and selection only — GO/TWEAK/STOP, stage states, and
 * provenance colors stay platform-fixed so status reads the same for every
 * client. A contrast guard keeps configured colors usable as button fills.
 */
export function BrandingSettings({ draft, updateDraft, disabled }: {
  draft: WorkspaceSettings;
  updateDraft: <K extends keyof WorkspaceSettings>(key: K, value: WorkspaceSettings[K]) => void;
  disabled?: boolean;
}) {
  const primary = draft.primaryColor ?? DEFAULT_PRIMARY;
  const primaryContrast = draft.primaryColor ? contrastVsWhite(draft.primaryColor) : null;
  const primaryFails = primaryContrast !== null && primaryContrast < 4.5;
  const reportTitle = (draft.defaultReportTitle || '{sample} commercialization report')
    .replace(/\{sample\}/g, 'Sample A');

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Palette className="size-5 text-slate-500" />Brand identity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="logo-url">Logo URL</Label>
            <Input
              id="logo-url"
              value={draft.logoUrl ?? ''}
              onChange={event => updateDraft('logoUrl', event.target.value.trim() || null)}
              placeholder="https://…/logo.png"
              disabled={disabled}
            />
          </div>
          <ColorField id="primary-color" label="Primary color" value={draft.primaryColor} onChange={value => updateDraft('primaryColor', value)} disabled={disabled} />
          {primaryFails && (
            <div className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="size-3.5 shrink-0 mt-0.5" aria-hidden />
              <span>
                This color is {primaryContrast.toFixed(1)}:1 against white — below the 4.5:1 needed for readable
                button text. A darker shade of the same hue will be used for text and borders until it passes.
              </span>
            </div>
          )}
          <ColorField id="accent-color" label="Accent color" value={draft.accentColor} onChange={value => updateDraft('accentColor', value)} disabled={disabled} />
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700">
            Brand color applies to primary actions, selection, and the report cover.
            GO/TWEAK/STOP, workflow-stage, and data-provenance colors are platform-fixed
            so status reads identically for every client.
          </p>

          {/* Concept brand kit: the durable house style AI concept visuals build on. */}
          <div className="space-y-3 border-t border-slate-200 pt-4">
            <Label className="flex items-center gap-1.5">
              <Star className="size-4 text-slate-500" aria-hidden /> Concept brand kit
            </Label>
            {draft.brandKit ? (
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs leading-5 text-slate-700">
                  Adopted from <span className="font-semibold">{draft.brandKit.sourceConceptName || 'a concept visual'}</span>
                  {draft.brandKit.updatedAt ? ` on ${new Date(draft.brandKit.updatedAt).toLocaleDateString()}` : ''}.
                  New concept visuals use it as the house-style reference so every concept reads as this company's brand.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="brand-kit-descriptor" className="text-xs font-medium">House style notes</Label>
                  <Input
                    id="brand-kit-descriptor"
                    value={draft.brandKit.brandDescriptor}
                    onChange={event => updateDraft('brandKit', {
                      ...draft.brandKit!,
                      brandDescriptor: event.target.value,
                    })}
                    placeholder="e.g. matte kraft materials, deep green accents, quiet serif voice"
                    disabled={disabled}
                    className="text-xs"
                  />
                  <p className="text-[11px] text-slate-500">
                    Included in every concept-image prompt alongside the reference image.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={disabled}
                  onClick={() => updateDraft('brandKit', null)}
                  className="h-8 text-xs"
                >
                  Clear brand kit
                </Button>
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-xs leading-5 text-slate-500">
                No brand kit yet. Approve a concept visual in Concept Lab and choose
                “Set as company brand” — future concepts will then build on that house style
                instead of starting from scratch.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader><CardTitle className="text-lg">Report voice</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="default-report-title">Default report title</Label>
            <Input
              id="default-report-title"
              value={draft.defaultReportTitle}
              onChange={event => updateDraft('defaultReportTitle', event.target.value)}
              placeholder="{sample} commercialization report"
              disabled={disabled}
            />
            <p className="text-xs text-slate-500">{'{sample}'} expands to the sample name.</p>
          </div>
          <div className="space-y-2">
            <Label>Report tone</Label>
            <Select value={draft.reportTone} onValueChange={value => updateDraft('reportTone', value as WorkspaceSettings['reportTone'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="formal">Formal — measured, regulatory-ready phrasing</SelectItem>
                <SelectItem value="standard">Standard — clear business language</SelectItem>
                <SelectItem value="energetic">Energetic — launch-pitch phrasing</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>PDF layout</Label>
            <Select value={draft.reportTemplate} onValueChange={value => updateDraft('reportTemplate', value as WorkspaceSettings['reportTemplate'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard — navy/blue editorial layout</SelectItem>
                <SelectItem value="editorial-sage">Editorial sage — cream masthead with sage banners</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">Controls the cover, section banners, and footer style of the commercialization report PDF.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-footer">Report footer</Label>
            <Input
              id="report-footer"
              value={draft.reportFooter}
              onChange={event => updateDraft('reportFooter', event.target.value)}
              placeholder="Confidential — prepared for internal review"
              disabled={disabled}
            />
          </div>

          {/* Live preview: topbar chip + report cover thumbnail */}
          <div className="space-y-2 border-t border-slate-200 pt-4">
            <Label>Preview</Label>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
              {draft.logoUrl ? (
                <img src={draft.logoUrl} alt="" className="size-6 rounded object-contain" />
              ) : (
                <span className="flex size-6 items-center justify-center rounded bg-slate-50 text-[11px] font-bold text-slate-500">
                  {(draft.organizationName || 'SP').slice(0, 2).toUpperCase()}
                </span>
              )}
              <span className="text-sm font-semibold text-slate-900">{draft.organizationName || 'Sensory Platform'}</span>
              <span
                className="ml-auto rounded-md px-2.5 py-1 text-xs font-bold text-white"
                style={{ backgroundColor: primary }}
              >
                Primary action
              </span>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="h-1.5 w-full rounded-full" style={{ backgroundColor: primary }} />
              <p className="mt-2 text-sm font-bold text-slate-900">{reportTitle}</p>
              <p className="text-[11px] text-slate-500">{draft.organizationName || 'Sensory Platform'} · {draft.reportTone} tone</p>
              {draft.reportFooter && <p className="mt-2 border-t border-slate-200 pt-1.5 text-[11px] text-slate-500">{draft.reportFooter}</p>}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

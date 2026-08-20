import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Label } from '../ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { ChevronDown, ShieldCheck, Users, UserCheck } from 'lucide-react';
import { usePanelists } from '../../lib/hooks';
import { EligiblePanelSummary } from '../eligible-panel-summary';
import { buildConceptPanelRoster } from './concept-panel-roster';

export function PanelStep({
  panelSize,
  setPanelSize,
  targetSegments,
  setTargetSegments,
  assignedPanelistIds,
  setAssignedPanelistIds,
}: {
  panelSize: number;
  setPanelSize: (n: number) => void;
  targetSegments: string[];
  setTargetSegments: (s: string[]) => void;
  assignedPanelistIds: string[];
  setAssignedPanelistIds: (ids: string[]) => void;
}) {
  const [panelSetupOpen, setPanelSetupOpen] = useState(false);
  const { data: panelists = [], isLoading: panelistsLoading } = usePanelists();
  const registeredPanelists = useMemo(() => buildConceptPanelRoster(panelists), [panelists]);
  const unavailableCount = Math.max(0, panelists.length - registeredPanelists.length);

  useEffect(() => {
    if (panelistsLoading) return;
    const eligibleIds = new Set(registeredPanelists.map(panelist => panelist.id));
    const safeSelection = assignedPanelistIds.filter(id => eligibleIds.has(id));
    if (safeSelection.length !== assignedPanelistIds.length) setAssignedPanelistIds(safeSelection);
  }, [assignedPanelistIds, panelistsLoading, registeredPanelists, setAssignedPanelistIds]);

  const segments = ['Everyday consumers', 'Health-conscious', 'Vegan / plant-based', 'Flexitarian', 'Foodservice buyers', 'Retail buyers', 'Seniors 55+', 'Parents with children', 'Young adults 18–34'];

  const toggle = (seg: string) =>
    setTargetSegments(
      targetSegments.includes(seg)
        ? targetSegments.filter(s => s !== seg)
        : [...targetSegments, seg]
    );

  const togglePanelist = (id: string) =>
    setAssignedPanelistIds(
      assignedPanelistIds.includes(id)
        ? assignedPanelistIds.filter(p => p !== id)
        : [...assignedPanelistIds, id]
    );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Target your panel</h2>
        <p className="text-slate-500 text-sm mt-1">Choose the research-ready adults who receive this concept-only survey.</p>
      </div>

      <div className="space-y-3">
        <Label className="font-medium text-sm flex items-center gap-1.5">
          <UserCheck className="size-3.5" /> Available panelists
        </Label>
        <p className="text-xs text-slate-500 -mt-1">
          A formulation is not required because this study presents a concept, not a food sample. Active adults with a current research profile appear here.
        </p>
        {panelistsLoading ? (
          <p className="text-sm text-slate-500">Loading available panelists…</p>
        ) : registeredPanelists.length === 0 ? (
          <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">No research-ready adults are currently available. Complete or renew a panelist profile in Panelists.</p>
        ) : (
          <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-56 overflow-y-auto">
            {registeredPanelists.map(p => (
              <label
                key={p.id}
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={assignedPanelistIds.includes(p.id)}
                  onChange={() => togglePanelist(p.id)}
                  className="rounded accent-blue-600"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900">{p.name}</div>
                  <div className="text-xs text-slate-500">
                    {[p.panelistId ?? 'No ID assigned', p.ageBand, p.region, `${p.completedCount} completed`].filter(Boolean).join(' · ')}
                  </div>
                </div>
                {assignedPanelistIds.includes(p.id) && (
                  <span className="text-xs font-semibold text-blue-600 flex-shrink-0">Selected</span>
                )}
              </label>
            ))}
          </div>
        )}
        {assignedPanelistIds.length > 0 && (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <ShieldCheck className="size-3.5" aria-hidden />{assignedPanelistIds.length} panelist{assignedPanelistIds.length !== 1 ? 's' : ''} assigned to this concept test
          </p>
        )}
        {!panelistsLoading && <p className="text-xs text-slate-500">{registeredPanelists.length} available · {unavailableCount} unavailable because their account or research profile is not ready.</p>}
        <EligiblePanelSummary panelists={registeredPanelists} selectedIds={assignedPanelistIds} />
      </div>

      <Collapsible open={panelSetupOpen} onOpenChange={setPanelSetupOpen} className="rounded-lg border border-slate-200">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
          <div>
            <p className="text-sm font-semibold text-slate-900">Response goal and audience notes</p>
            <p className="mt-0.5 text-xs text-slate-500">Goal: {panelSize} responses · {assignedPanelistIds.length} assigned{targetSegments.length > 0 ? ` · ${targetSegments.length} audience note${targetSegments.length === 1 ? '' : 's'}` : ''}</p>
          </div>
          <ChevronDown className={`size-4 text-slate-500 transition-transform ${panelSetupOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-5 border-t border-slate-200 p-4">
          <Card className="border border-slate-200 shadow-none">
            <CardContent className="py-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="font-semibold text-slate-900">Response goal</div>
                <div className="text-lg font-bold text-slate-900">{panelSize}</div>
              </div>
              <input
                type="range"
                aria-label="Target panel size"
                min={10}
                max={100}
                step={5}
                value={panelSize}
                onChange={e => setPanelSize(Number(e.target.value))}
                className="w-full accent-blue-600"
              />
              <div className="mt-1 flex justify-between text-xs text-slate-500">
                <span>10</span>
                <span>100</span>
              </div>
              <p className="mt-3 text-xs text-slate-500">This is a study goal, not an automatic assignment. Assign enough available panelists above to reach it.</p>
            </CardContent>
          </Card>

          <div>
            <Label className="mb-3 block text-sm font-medium">Optional audience notes</Label>
            <div className="flex flex-wrap gap-2">
              {segments.map(seg => (
                <button
                  key={seg}
                  type="button"
                  onClick={() => toggle(seg)}
                  aria-pressed={targetSegments.includes(seg)}
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                    targetSegments.includes(seg)
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-200 text-slate-700 hover:border-blue-400 hover:text-blue-700'
                  }`}
                >
                  {seg}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 rounded-md bg-slate-50 p-3">
            <Users className="mt-0.5 size-4 shrink-0 text-slate-500" />
            <p className="text-xs text-slate-700">
              Assigned panelists receive the test in their dashboard. Audience notes guide study planning; they do not filter the roster, create quotas, or persist after launch.
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

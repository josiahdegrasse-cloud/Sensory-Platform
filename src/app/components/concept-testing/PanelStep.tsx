import { useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Label } from '../ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { ChevronDown, Users, UserCheck } from 'lucide-react';
import { usePanelists } from '../../lib/hooks';
import { filterAssignablePanelists, getAssignmentSummary } from '../../lib/assignments';

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
  const { data: panelists = [] } = usePanelists();
  const registeredPanelists = filterAssignablePanelists(panelists);
  const assignment = getAssignmentSummary('concept', { assignedPanelistIds }, panelists);

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
        <p className="text-slate-500 text-sm mt-1">Choose who receives this concept test.</p>
      </div>

      <div className="space-y-3">
        <Label className="font-medium text-sm flex items-center gap-1.5">
          <UserCheck className="size-3.5" /> Assign to registered panelists
        </Label>
        <p className="text-xs text-slate-500 -mt-1">
          Assign at least one registered panelist. Only assigned panelists can access this concept test.
        </p>
        {registeredPanelists.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No registered panelists found.</p>
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
                    {p.panelistId ?? 'No ID assigned'} · {p.completedCount} evaluation{p.completedCount !== 1 ? 's' : ''} completed
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
          <p className="text-xs font-semibold text-blue-600">
            {assignment.activeAssignedIds.length} active panelist{assignment.activeAssignedIds.length !== 1 ? 's' : ''} will receive this concept test
          </p>
        )}
        {assignment.inactiveAssignedIds.length > 0 && (
          <p className="text-xs font-medium text-amber-700">
            {assignment.inactiveAssignedIds.length} saved selection{assignment.inactiveAssignedIds.length === 1 ? '' : 's'} belong to inactive or archived panelists and will not be available for new assignment.
          </p>
        )}
      </div>

      <Collapsible open={panelSetupOpen} onOpenChange={setPanelSetupOpen} className="rounded-lg border border-slate-200">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
          <div>
            <p className="text-sm font-semibold text-slate-900">Panel guidance and segments</p>
            <p className="mt-0.5 text-xs text-slate-500">Target size {panelSize}{targetSegments.length > 0 ? `, ${targetSegments.length} segment${targetSegments.length === 1 ? '' : 's'}` : ''}</p>
          </div>
          <ChevronDown className={`size-4 text-slate-500 transition-transform ${panelSetupOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-5 border-t border-slate-200 p-4">
          <Card className="border border-slate-200 shadow-none">
            <CardContent className="py-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="font-semibold text-slate-900">Target panel size</div>
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
              <p className="mt-3 text-xs text-slate-500">50–100 responses are recommended for stronger purchase-intent signals.</p>
            </CardContent>
          </Card>

          <div>
            <Label className="mb-3 block text-sm font-medium">Consumer segments to note</Label>
            <div className="flex flex-wrap gap-2">
              {segments.map(seg => (
                <button
                  key={seg}
                  type="button"
                  onClick={() => toggle(seg)}
                  aria-pressed={targetSegments.includes(seg)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
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
              Assigned panelists receive the test in their dashboard. Segment choices guide setup but are not saved after launch.
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

import { Card, CardContent } from '../ui/card';
import { Label } from '../ui/label';
import { Users, UserCheck } from 'lucide-react';
import { usePanelists } from '../../lib/hooks';

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
  const { data: panelists = [] } = usePanelists();
  const registeredPanelists = panelists;

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

      <Card className="border-2 border-blue-200">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="font-bold text-slate-900">Panel size</div>
            <div className="text-2xl font-black text-blue-600">{panelSize}</div>
          </div>
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            value={panelSize}
            onChange={e => setPanelSize(Number(e.target.value))}
            className="w-full accent-blue-600"
          />
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>10 panelists</span>
            <span>100 panelists</span>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            We recommend <strong>50–100 respondents</strong> for statistically reliable purchase intent signals.
          </p>
        </CardContent>
      </Card>

      <div>
        <Label className="font-medium text-sm mb-3 block">Consumer segments to note</Label>
        <div className="flex flex-wrap gap-2">
          {segments.map(seg => (
            <button
              key={seg}
              onClick={() => toggle(seg)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                targetSegments.includes(seg)
                  ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                  : 'border-slate-300 text-slate-600 hover:border-blue-400 hover:text-blue-700'
              }`}
            >
              {seg}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label className="font-medium text-sm flex items-center gap-1.5">
          <UserCheck className="size-3.5" /> Assign to registered panelists
        </Label>
        <p className="text-xs text-slate-500 -mt-1">
          Select specific panelists. If nobody is selected, every active panelist can see this concept test.
        </p>
        {registeredPanelists.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No registered panelists found.</p>
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
                  <div className="text-xs text-slate-400">
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
            {assignedPanelistIds.length} panelist{assignedPanelistIds.length !== 1 ? 's' : ''} will receive this concept test
          </p>
        )}
      </div>

      <Card className="border border-amber-200 bg-amber-50">
        <CardContent className="py-4 px-4">
          <div className="flex gap-2">
            <Users className="size-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">How assignment works</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Selected panelists will see this concept test in their dashboard alongside food evaluations. Segment tags are saved as planning notes; named assignments control access today.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

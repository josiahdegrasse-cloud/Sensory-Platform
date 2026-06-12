import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileText,
  FolderKanban,
  Image as ImageIcon,
  Users,
} from 'lucide-react';
import type { ConceptDraft, Question } from './types';
import { CATEGORY_COLORS } from './types';
import { usePanelists } from '../../lib/hooks';
import { getConceptReadiness } from './concept-readiness';
import { estimateSurveySeconds, formatSurveyDuration } from './survey-utils';

export function ReviewStep({
  draft,
  questions,
  panelSize,
  segments,
  assignedPanelistIds,
  onEditConcept,
  onEditSurvey,
}: {
  draft: ConceptDraft;
  questions: Question[];
  panelSize: number;
  segments: string[];
  assignedPanelistIds: string[];
  onEditConcept: () => void;
  onEditSurvey: () => void;
}) {
  const { data: panelists = [] } = usePanelists();
  const readiness = getConceptReadiness({ draft, questions, assignedPanelistIds, panelists });
  const blockers = readiness.filter(item => !item.ready);
  const selectedImages = draft.marketingImages.filter(image => image.trim());
  const estimatedDuration = formatSurveyDuration(estimateSurveySeconds(questions));
  const assignedPanelists = assignedPanelistIds.map(id => {
    const panelist = panelists.find(candidate => candidate.id === id);
    return panelist?.name || panelist?.panelistId || id;
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Review & launch</h2>
        <p className="text-slate-500 text-sm mt-1">Confirm everything looks right before sending to your panel.</p>
      </div>

      {blockers.length > 0 ? (
        <Card className="border border-amber-300 bg-amber-50">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden />
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-amber-950">Launch is blocked</h3>
                <p className="mt-1 text-sm text-amber-800">Complete the following items before launching this concept test.</p>
                <ul className="mt-3 space-y-2">
                  {blockers.map(item => (
                    <li key={item.id} className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-white/70 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-sm text-amber-950"><strong>{item.label}:</strong> {item.detail}</span>
                      <button
                        type="button"
                        onClick={item.fixStep === 'concept' ? onEditConcept : onEditSurvey}
                        className="shrink-0 text-left text-xs font-semibold text-blue-700 hover:text-blue-900"
                      >
                        Edit {item.fixStep === 'concept' ? 'concept' : 'survey and panel'}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="size-4" aria-hidden />
          All launch requirements are complete.
        </div>
      )}

      <Card className="border border-slate-200">
        <CardContent className="py-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
            {[
              [ImageIcon, 'Selected visuals', String(selectedImages.length)],
              [FileText, 'Survey questions', String(questions.length)],
              [Clock3, 'Estimated time', estimatedDuration],
              [Users, 'Assigned panelists', String(assignedPanelistIds.length)],
            ].map(([Icon, label, value]) => (
              <div key={String(label)} className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <Icon className="size-3.5" aria-hidden />
                  {String(label)}
                </div>
                <p className="mt-1 text-base font-semibold text-slate-900">{String(value)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <FolderKanban className="size-4" aria-hidden />
            Concept brief
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="text-xs font-semibold text-slate-500">Project</div>
            <div className="text-sm font-semibold text-slate-900">{draft.projectName || '(project not named)'}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500">Concept test</div>
            <div className="text-base font-bold text-slate-900">{draft.name || '(concept not named)'}</div>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">{draft.category}</div>
          {draft.description && <p className="text-sm text-slate-700 mt-2">{draft.description}</p>}
          <div className="flex flex-wrap gap-3 text-xs text-slate-600">
            {draft.targetMarket && <span><strong>Target:</strong> {draft.targetMarket}</span>}
            {draft.pricePoint && <span><strong>Price:</strong> {draft.pricePoint}</span>}
            {draft.keyBenefits && <span><strong>Benefits:</strong> {draft.keyBenefits}</span>}
            {selectedImages.length > 0 && (
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="size-3.5" aria-hidden />
                {selectedImages.length} concept visual{selectedImages.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-slate-700">Survey questions ({questions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-1.5">
            {questions.map((q, i) => (
              <li key={q.id} className="flex items-start gap-2 text-sm">
                <span className="text-slate-400 font-bold w-5 flex-shrink-0">{i + 1}.</span>
                <span className="text-slate-700 line-clamp-1">{q.text || <em className="text-slate-400">Empty question</em>}</span>
                <span className={`ml-auto flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${CATEGORY_COLORS[q.category]}`}>{q.category}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card className="border border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-slate-700">Assigned panelists ({assignedPanelistIds.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {assignedPanelists.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {assignedPanelists.map((name, index) => (
                <Badge key={`${assignedPanelistIds[index]}-${name}`} variant="outline">{name}</Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-amber-700">No panelists assigned. The test cannot launch.</p>
          )}
          <p className="mt-3 text-xs text-slate-500">
            Target panel size: {panelSize}. Access is limited to the named panelists above.
          </p>
        </CardContent>
      </Card>

      {segments.length > 0 && (
        <Card className="border border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-slate-700">Target segments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {segments.map(s => (
                <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">Used to guide this test and shown in this setup summary. These segment choices are not saved after launch.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

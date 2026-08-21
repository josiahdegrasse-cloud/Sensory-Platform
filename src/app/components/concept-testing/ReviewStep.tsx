import { Badge } from '../ui/badge';
import {
  AlertTriangle,
  CheckCircle2,
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

function visualStatusClasses(status: string | undefined) {
  if (status === 'approved') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'rejected') return 'border-rose-200 bg-rose-50 text-rose-800';
  if (status === 'selected') return 'border-blue-200 bg-blue-50 text-blue-800';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function visualStatusLabel(status: string | undefined) {
  if (status === 'approved') return 'Approved';
  if (status === 'rejected') return 'Rejected';
  if (status === 'selected') return 'Selected';
  return 'Draft';
}

export function ReviewStep({
  draft,
  questions,
  segments,
  assignedPanelistIds,
  requireApprovedVisuals,
  onEditConcept,
  onEditVisuals,
  onEditSurvey,
  onEditPanel,
}: {
  draft: ConceptDraft;
  questions: Question[];
  segments: string[];
  assignedPanelistIds: string[];
  requireApprovedVisuals: boolean;
  onEditConcept: () => void;
  onEditVisuals: () => void;
  onEditSurvey: () => void;
  onEditPanel: () => void;
}) {
  const { data: panelists = [] } = usePanelists();
  const { items: readiness } = getConceptReadiness({
    draft, questions, assignedPanelistIds, panelists,
    requireApprovedVisuals,
  });
  const blockers = readiness.filter(item => !item.ready);
  const selectedImageEntries = draft.marketingImages
    .map((image, index) => ({
      image,
      review: draft.marketingImageReviews[index],
      originalIndex: index,
    }))
    .filter(entry => entry.image.trim());
  const selectedImages = selectedImageEntries.map(entry => entry.image);
  const estimatedDuration = formatSurveyDuration(estimateSurveySeconds(questions));
  const assignedPanelists = assignedPanelistIds.map(id => {
    const panelist = panelists.find(candidate => candidate.id === id);
    return panelist?.name || panelist?.panelistId || id;
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-950">Review before launch</h2>
        <p className="mt-1 text-sm text-slate-600">
          Confirm the study setup at a glance. Edit any section that needs a final change.
        </p>
      </div>

      {blockers.length > 0 ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden />
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-amber-950">Complete {blockers.length} item{blockers.length === 1 ? '' : 's'} before launch</h3>
              <ul className="mt-2 divide-y divide-amber-200">
                {blockers.map(item => (
                  <li key={item.id} className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-sm text-amber-950"><strong>{item.label}:</strong> {item.detail}</span>
                    <button
                      type="button"
                      onClick={item.fixStep === 'panel'
                        ? onEditPanel
                        : item.fixStep === 'survey'
                          ? onEditSurvey
                          : item.fixStep === 'visuals'
                            ? onEditVisuals
                            : onEditConcept}
                      className="min-h-11 shrink-0 text-left text-xs font-semibold text-blue-700 hover:text-blue-900"
                    >
                      Edit {item.fixStep === 'concept' ? 'brief' : item.fixStep}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="size-4" aria-hidden />
          Everything needed is ready. Review the summary, then launch the test.
        </div>
      )}

      <div className="divide-y divide-slate-200 border-y border-slate-200">
        <section className="py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><FolderKanban className="size-4" aria-hidden /></span>
              <div>
                <h3 className="text-sm font-semibold text-slate-950">Concept brief</h3>
                <p className="mt-0.5 text-xs text-slate-600">{draft.name || 'Untitled'} · {draft.category || 'Category not set'}</p>
              </div>
            </div>
            <button type="button" onClick={onEditConcept} className="min-h-11 shrink-0 text-xs font-semibold text-blue-700 hover:text-blue-900">Edit brief</button>
          </div>
          {draft.description && <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-700">{draft.description}</p>}
          <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-3">
            <div><dt className="text-slate-500">Project</dt><dd className="mt-0.5 font-semibold text-slate-800">{draft.projectName || 'Not named'}</dd></div>
            <div><dt className="text-slate-500">Target market</dt><dd className="mt-0.5 font-semibold text-slate-800">{draft.targetMarket || 'Not set'}</dd></div>
            <div><dt className="text-slate-500">Price point</dt><dd className="mt-0.5 font-semibold text-slate-800">{draft.pricePoint || 'Not set'}</dd></div>
          </dl>
        </section>

        <section className="py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><ImageIcon className="size-4" aria-hidden /></span>
              <div>
                <h3 className="text-sm font-semibold text-slate-950">Visuals</h3>
                <p className="mt-0.5 text-xs text-slate-600">{selectedImages.length} selected for the study</p>
              </div>
            </div>
            <button type="button" onClick={onEditVisuals} className="min-h-11 shrink-0 text-xs font-semibold text-blue-700 hover:text-blue-900">Edit visuals</button>
          </div>
          <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
            {selectedImageEntries.map(({ image, review, originalIndex }, index) => (
              <div key={`${image}-${originalIndex}`} className="w-28 shrink-0">
                <img src={image} alt={`Selected concept visual ${index + 1}`} loading="lazy" decoding="async" className="aspect-square w-full rounded-lg border border-slate-200 object-cover" />
                <span className={`mt-1.5 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${visualStatusClasses(review?.status)}`}>
                  {visualStatusLabel(review?.status)}
                </span>
              </div>
            ))}
            {selectedImages.length === 0 && <p className="text-sm text-amber-700">No concept visual selected.</p>}
          </div>
        </section>

        <section className="py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><FileText className="size-4" aria-hidden /></span>
              <div>
                <h3 className="text-sm font-semibold text-slate-950">Survey</h3>
                <p className="mt-0.5 text-xs text-slate-600">{questions.length} question{questions.length === 1 ? '' : 's'} · about {estimatedDuration}</p>
              </div>
            </div>
            <button type="button" onClick={onEditSurvey} className="min-h-11 shrink-0 text-xs font-semibold text-blue-700 hover:text-blue-900">Edit survey</button>
          </div>
          <ol className="mt-3 space-y-2">
            {questions.slice(0, 5).map((question, index) => (
              <li key={question.id} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="w-5 shrink-0 text-xs font-semibold text-slate-500">{index + 1}.</span>
                <span className="min-w-0 flex-1 truncate">{question.text || 'Empty question'}</span>
                <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${CATEGORY_COLORS[question.category]}`}>{question.category}</span>
              </li>
            ))}
          </ol>
          {questions.length > 5 && <p className="mt-2 text-xs text-slate-500">And {questions.length - 5} more questions</p>}
        </section>

        <section className="py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><Users className="size-4" aria-hidden /></span>
              <div>
                <h3 className="text-sm font-semibold text-slate-950">Panel</h3>
                <p className="mt-0.5 text-xs text-slate-600">{assignedPanelistIds.length} panelist{assignedPanelistIds.length === 1 ? '' : 's'} assigned</p>
              </div>
            </div>
            <button type="button" onClick={onEditPanel} className="min-h-11 shrink-0 text-xs font-semibold text-blue-700 hover:text-blue-900">Edit panel</button>
          </div>
          {assignedPanelists.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {assignedPanelists.slice(0, 8).map((name, index) => (
                <Badge key={`${assignedPanelistIds[index]}-${name}`} variant="outline">{name}</Badge>
              ))}
              {assignedPanelists.length > 8 && <Badge variant="outline">+{assignedPanelists.length - 8} more</Badge>}
            </div>
          ) : (
            <p className="mt-3 text-sm text-amber-700">No active panelists assigned.</p>
          )}
          {segments.length > 0 && <p className="mt-3 text-xs text-slate-600">Segments: {segments.join(', ')}</p>}
        </section>
      </div>
    </div>
  );
}

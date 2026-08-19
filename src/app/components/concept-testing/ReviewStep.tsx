import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
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
  onEditSurvey,
  onEditPanel,
}: {
  draft: ConceptDraft;
  questions: Question[];
  segments: string[];
  assignedPanelistIds: string[];
  requireApprovedVisuals: boolean;
  onEditConcept: () => void;
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
        <h2 className="text-xl font-bold text-slate-900">Review before sending</h2>
        <p className="text-slate-500 text-sm mt-1">
          Check the concept, visuals, survey, and recipients before sending.
        </p>
      </div>

      {blockers.length > 0 ? (
        <Card className="border border-amber-300 bg-amber-50">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden />
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-amber-950">A few things need attention</h3>
                <p className="mt-1 text-sm text-amber-800">Complete these items before sending the survey.</p>
                <ul className="mt-3 space-y-2">
                  {blockers.map(item => (
                    <li key={item.id} className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-white/70 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-sm text-amber-950"><strong>{item.label}:</strong> {item.detail}</span>
                      <button
                        type="button"
                        onClick={item.fixStep === 'panel' ? onEditPanel : item.fixStep === 'survey' ? onEditSurvey : onEditConcept}
                        className="shrink-0 text-left text-xs font-semibold text-blue-700 hover:text-blue-900"
                      >
                        Edit {item.fixStep === 'panel' ? 'panel' : item.fixStep === 'survey' ? 'survey' : 'concept'}
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
          Everything needed is selected. Review the details below, then send when you are ready.
        </div>
      )}

      <Accordion type="multiple" className="rounded-lg border border-slate-200 px-4">
        <AccordionItem value="concept">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <FolderKanban className="size-4 text-slate-500" aria-hidden />
              Concept brief
              <span className="font-normal text-slate-500">{draft.name || 'Untitled'}</span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3">
            <div className="flex justify-end">
              <button type="button" onClick={onEditConcept} className="text-xs font-semibold text-blue-700 hover:text-blue-900">Edit concept</button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><p className="text-xs font-semibold text-slate-500">Project</p><p className="text-sm text-slate-900">{draft.projectName || '(project not named)'}</p></div>
              <div><p className="text-xs font-semibold text-slate-500">Category</p><p className="text-sm text-slate-900">{draft.category || '(category not set)'}</p></div>
            </div>
            {draft.description && <p className="text-sm text-slate-700">{draft.description}</p>}
            <div className="flex flex-wrap gap-3 text-xs text-slate-700">
              {draft.targetMarket && <span><strong>Target:</strong> {draft.targetMarket}</span>}
              {draft.pricePoint && <span><strong>Price:</strong> {draft.pricePoint}</span>}
              {draft.keyBenefits && <span><strong>Benefits:</strong> {draft.keyBenefits}</span>}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="visuals">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <ImageIcon className="size-4 text-slate-500" aria-hidden />
              Visuals
              <span className="font-normal text-slate-500">{selectedImages.length} selected</span>
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="mb-3 flex justify-end">
              <button type="button" onClick={onEditConcept} className="text-xs font-semibold text-blue-700 hover:text-blue-900">Edit visuals</button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {selectedImageEntries.map(({ image, review, originalIndex }, index) => {
                return (
                  <div key={`${image}-${originalIndex}`} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <img src={image} alt={`Selected concept visual ${index + 1}`} loading="lazy" decoding="async" className="aspect-square w-full object-cover" />
                    <div className="space-y-1.5 border-t border-slate-200 p-2">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${visualStatusClasses(review?.status)}`}>
                        {visualStatusLabel(review?.status)}
                      </span>
                      {requireApprovedVisuals && review?.status !== 'approved' && (
                        <p className="text-[11px] leading-4 text-amber-700">Approval required before launch.</p>
                      )}
                      {review?.notes && (
                        <p className="line-clamp-2 text-[11px] leading-4 text-slate-500">{review.notes}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="survey">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <FileText className="size-4 text-slate-500" aria-hidden />
              Survey
              <span className="font-normal text-slate-500">{questions.length} questions, {estimatedDuration}</span>
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="mb-3 flex justify-end">
              <button type="button" onClick={onEditSurvey} className="text-xs font-semibold text-blue-700 hover:text-blue-900">Edit survey</button>
            </div>
            <ol className="space-y-1.5">
              {questions.map((q, i) => (
                <li key={q.id} className="flex items-start gap-2 text-sm">
                  <span className="text-slate-500 font-bold w-5 flex-shrink-0">{i + 1}.</span>
                  <span className="text-slate-700 line-clamp-1">{q.text || <em className="text-slate-500">Empty question</em>}</span>
                  <span className={`ml-auto flex-shrink-0 text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${CATEGORY_COLORS[q.category]}`}>{q.category}</span>
                </li>
              ))}
            </ol>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="panel">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <Users className="size-4 text-slate-500" aria-hidden />
              Panel
              <span className="font-normal text-slate-500">{assignedPanelistIds.length} assigned</span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3">
            <div className="flex justify-end">
              <button type="button" onClick={onEditPanel} className="text-xs font-semibold text-blue-700 hover:text-blue-900">Edit panel</button>
            </div>
            {assignedPanelists.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {assignedPanelists.map((name, index) => (
                  <Badge key={`${assignedPanelistIds[index]}-${name}`} variant="outline">{name}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-amber-700">No panelists assigned. The test cannot launch.</p>
            )}
            <p className="text-xs text-slate-500">The survey will be available only to the assigned panelists above.</p>
            {segments.length > 0 && (
              <>
                <p className="text-xs font-semibold text-slate-700">Segments noted for setup</p>
                <div className="flex flex-wrap gap-2">
                  {segments.map(s => (
                    <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                  ))}
                </div>
              </>
            )}
          </AccordionContent>
        </AccordionItem>

      </Accordion>
    </div>
  );
}

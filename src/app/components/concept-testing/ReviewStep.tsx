import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
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
  onEditVisuals,
  onEditSurvey,
}: {
  draft: ConceptDraft;
  questions: Question[];
  panelSize: number;
  segments: string[];
  assignedPanelistIds: string[];
  onEditConcept: () => void;
  onEditVisuals: () => void;
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
                        onClick={item.fixStep === 'concept' ? onEditConcept : item.fixStep === 'visuals' ? onEditVisuals : onEditSurvey}
                        className="shrink-0 text-left text-xs font-semibold text-blue-700 hover:text-blue-900"
                      >
                        Edit {item.fixStep === 'concept' ? 'concept' : item.fixStep === 'visuals' ? 'visuals' : 'survey and panel'}
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
            <div className="grid gap-3 sm:grid-cols-2">
              <div><p className="text-xs font-semibold text-slate-500">Project</p><p className="text-sm text-slate-900">{draft.projectName || '(project not named)'}</p></div>
              <div><p className="text-xs font-semibold text-slate-500">Category</p><p className="text-sm text-slate-900">{draft.category || '(category not set)'}</p></div>
            </div>
            {draft.description && <p className="text-sm text-slate-700">{draft.description}</p>}
            <div className="flex flex-wrap gap-3 text-xs text-slate-600">
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {selectedImages.map((image, index) => (
                <img key={`${image}-${index}`} src={image} alt={`Selected concept visual ${index + 1}`} className="aspect-square w-full rounded-lg border border-slate-200 object-cover" />
              ))}
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
            <ol className="space-y-1.5">
              {questions.map((q, i) => (
                <li key={q.id} className="flex items-start gap-2 text-sm">
                  <span className="text-slate-400 font-bold w-5 flex-shrink-0">{i + 1}.</span>
                  <span className="text-slate-700 line-clamp-1">{q.text || <em className="text-slate-400">Empty question</em>}</span>
                  <span className={`ml-auto flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${CATEGORY_COLORS[q.category]}`}>{q.category}</span>
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
            {assignedPanelists.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {assignedPanelists.map((name, index) => (
                  <Badge key={`${assignedPanelistIds[index]}-${name}`} variant="outline">{name}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-amber-700">No panelists assigned. The test cannot launch.</p>
            )}
            <p className="text-xs text-slate-500">Target panel size: {panelSize}. Access is limited to the named panelists above.</p>
            {segments.length > 0 && (
              <>
                <p className="text-xs font-semibold text-slate-600">Segments noted for setup</p>
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

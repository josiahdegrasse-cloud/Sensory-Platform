import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileText,
  FolderKanban,
  Info,
  Image as ImageIcon,
  Layers,
  Users,
} from 'lucide-react';
import type { ConceptDraft, Question } from './types';
import { CATEGORY_COLORS } from './types';
import { usePanelists, useWorkspaceSettings } from '../../lib/hooks';
import { getConceptReadiness } from './concept-readiness';
import { estimateSurveySeconds, formatSurveyDuration } from './survey-utils';
import type { StudyQualityScore } from './study-quality-scorer';

// ─── Study Quality card ───────────────────────────────────────────────────────

const SUB_LABELS: Record<keyof Omit<StudyQualityScore, 'overall' | 'warnings'>, string> = {
  panelAdequacy:    'Panel',
  surveyBalance:    'Survey',
  conceptClarity:   'Clarity',
  researchIntegrity: 'Integrity',
};

function StudyQualityCard({ score }: { score: StudyQualityScore }) {
  const pct = score.overall;
  const ring = pct >= 75 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-rose-600';
  const errors = score.warnings.filter(w => w.severity === 'error');
  const warnings = score.warnings.filter(w => w.severity === 'warn');
  const infos = score.warnings.filter(w => w.severity === 'info');

  return (
    <Card className="border border-slate-200">
      <CardContent className="py-4 space-y-4">
        <div className="flex items-start gap-4">
          <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 min-w-[4.5rem]">
            <span className={`text-3xl font-bold tabular-nums ${ring}`}>{pct}</span>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">/100</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900">Study readiness</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {pct >= 75 ? 'This study is well-designed and ready to launch.'
                : pct >= 50 ? 'Good foundation — address the warnings below for stronger results.'
                : 'Several design issues detected. Review warnings before launching.'}
            </p>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {(Object.keys(SUB_LABELS) as (keyof typeof SUB_LABELS)[]).map(key => {
                const sub = score[key] as number;
                const fill = sub >= 19 ? 'bg-emerald-500' : sub >= 12 ? 'bg-amber-500' : 'bg-rose-400';
                return (
                  <div key={key} className="space-y-1">
                    <div className="h-1.5 w-full rounded-full bg-slate-50">
                      <div className={`h-1.5 rounded-full ${fill}`} style={{ width: `${(sub / 25) * 100}%` }} />
                    </div>
                    <p className="text-[11px] text-slate-500">{SUB_LABELS[key]} <span className="font-semibold text-slate-700">{sub}/25</span></p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {(errors.length > 0 || warnings.length > 0 || infos.length > 0) && (
          <ul className="space-y-1.5">
            {[...errors, ...warnings, ...infos].map(w => (
              <li key={w.code} className={`flex items-start gap-2 rounded-md px-3 py-2 text-xs ${
                w.severity === 'error' ? 'bg-rose-50 border border-rose-200 text-rose-800'
                : w.severity === 'warn' ? 'bg-amber-50 border border-amber-200 text-amber-800'
                : 'bg-blue-50 border border-blue-200 text-blue-800'
              }`}>
                {w.severity === 'error' ? <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  : w.severity === 'warn' ? <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  : <Info className="mt-0.5 size-3.5 shrink-0" />}
                {w.message}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Positioning summary ──────────────────────────────────────────────────────

const DIM_LABELS: Record<string, string> = {
  positioning: 'Brand positioning',
  visualComplexity: 'Visual complexity',
  appeal: 'Consumer appeal',
  channel: 'Primary channel',
  packagingFormat: 'Packaging format',
  brandColorScheme: 'Colour scheme',
  targetDemographic: 'Target demographic',
  pricePositioning: 'Price positioning',
};

const OPTION_LABELS: Record<string, string> = {
  premium: 'Premium', accessible: 'Accessible',
  minimal: 'Minimal', expressive: 'Expressive',
  health: 'Health-focused', indulgent: 'Indulgent',
  retail: 'Retail shelf', lifestyle: 'Lifestyle / DTC',
  young_active: 'Young & Active', family: 'Family', professional: 'Professional',
  senior: 'Senior', health_seeker: 'Health-seeker',
  budget: 'Budget', mainstream: 'Mainstream', ultra_premium: 'Ultra-premium',
  earthy: 'Earthy', vibrant: 'Vibrant', minimalist: 'Minimalist',
  luxury: 'Luxury', bold: 'Bold', pastel: 'Pastel',
  pouch: 'Pouch', block: 'Block', jar: 'Jar', can: 'Can',
  bottle: 'Bottle', sleeve: 'Sleeve', tray: 'Tray', tube: 'Tube',
};

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
  panelSize,
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
  panelSize: number;
  segments: string[];
  assignedPanelistIds: string[];
  requireApprovedVisuals: boolean;
  onEditConcept: () => void;
  onEditVisuals: () => void;
  onEditSurvey: () => void;
  onEditPanel: () => void;
}) {
  const { data: panelists = [] } = usePanelists();
  const { data: workspaceSettings } = useWorkspaceSettings();
  const { items: readiness, studyQuality } = getConceptReadiness({
    draft, questions, assignedPanelistIds, panelists,
    targetPanelSize: workspaceSettings?.defaultPanelSize,
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
        <h2 className="text-xl font-bold text-slate-900">Review & launch</h2>
        <p className="text-slate-500 text-sm mt-1">
          Confirm the approved concept stimulus, survey, and panel before launch.
        </p>
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
                        onClick={item.fixStep === 'concept' ? onEditConcept : item.fixStep === 'visuals' ? onEditVisuals : item.fixStep === 'panel' ? onEditPanel : onEditSurvey}
                        className="shrink-0 text-left text-xs font-semibold text-blue-700 hover:text-blue-900"
                      >
                        Edit {item.fixStep === 'concept' ? 'concept' : item.fixStep === 'visuals' ? 'visuals' : item.fixStep === 'panel' ? 'panel' : 'survey'}
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

      <StudyQualityCard score={studyQuality} />

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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {selectedImageEntries.map(({ image, review, originalIndex }, index) => {
                return (
                  <div key={`${image}-${originalIndex}`} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <img src={image} alt={`Selected concept visual ${index + 1}`} className="aspect-square w-full object-cover" />
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

        <AccordionItem value="positioning">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <Layers className="size-4 text-slate-500" aria-hidden />
              Concept positioning
              <span className="font-normal text-slate-500">
                {Object.values(draft.variantDimensions ?? {}).filter(v => v !== null).length} / 8 set
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(DIM_LABELS).map(([key, label]) => {
                const val = (draft.variantDimensions as unknown as Record<string, string | null> | undefined)?.[key] ?? null;
                return (
                  <div key={key} className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500 shrink-0">{label}</span>
                    {val ? (
                      <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                        {OPTION_LABELS[val] ?? val}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500 italic">Not specified</span>
                    )}
                  </div>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

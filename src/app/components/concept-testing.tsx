import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import {
  Lightbulb, ChevronRight, ChevronLeft, Plus, Trash2,
  Users, Send, CheckCircle2, Sparkles, GripVertical,
  DollarSign, Target, Package, Star, Image as ImageIcon, UserCheck,
} from 'lucide-react';
import { fetchPanelists, insertConceptTest, type PanelistInfo } from '../lib/database';

// ─── Types ────────────────────────────────────────────────────────────────────

type QuestionType = 'scale' | 'multiple_choice' | 'open_text' | 'ranking';

interface Question {
  id: string;
  text: string;
  type: QuestionType;
  options?: string[];
  required: boolean;
  category: 'appeal' | 'purchase' | 'price' | 'attributes' | 'demographics' | 'usage';
}

interface ConceptDraft {
  name: string;
  category: string;
  description: string;
  marketingImages: string[];
  targetMarket: string;
  pricePoint: string;
  keyBenefits: string;
  technicalChallenges: string;
}

type WizardStep = 'concept' | 'questions' | 'panel' | 'review' | 'launched';

// ─── AI-suggested question templates by product type ────────────────────────

const AI_QUESTION_TEMPLATES: Question[] = [
  { id: 'q1',  text: 'How appealing does this product concept sound to you overall?', type: 'scale', required: true, category: 'appeal' },
  { id: 'q2',  text: 'How likely are you to purchase this product if it were available?', type: 'scale', required: true, category: 'purchase' },
  { id: 'q3',  text: 'How well does this product fit your dietary preferences?', type: 'scale', required: true, category: 'appeal' },
  { id: 'q4',  text: 'What price per unit would you expect to pay for this product?', type: 'multiple_choice', options: ['Under $3', '$3–$5', '$5–$8', '$8–$12', 'Over $12'], required: true, category: 'price' },
  { id: 'q5',  text: 'What price would you consider too expensive for this product?', type: 'multiple_choice', options: ['Under $5', '$5–$8', '$8–$12', '$12–$18', 'Over $18'], required: false, category: 'price' },
  { id: 'q6',  text: 'Which of these attributes are most important to you in this product? (select all that apply)', type: 'multiple_choice', options: ['Taste/flavor', 'Texture', 'Nutritional value', 'Price', 'Sustainability', 'Convenience', 'Brand trust'], required: true, category: 'attributes' },
  { id: 'q7',  text: 'How well does this product deliver on its claimed benefits?', type: 'scale', required: true, category: 'appeal' },
  { id: 'q8',  text: 'How unique is this product compared to others you have tried?', type: 'scale', required: false, category: 'attributes' },
  { id: 'q9',  text: 'In which situations would you most likely use this product?', type: 'multiple_choice', options: ['Everyday meal', 'Special occasion', 'On-the-go snack', 'Cooking ingredient', 'Entertaining guests'], required: true, category: 'usage' },
  { id: 'q10', text: 'How often would you expect to purchase this product?', type: 'multiple_choice', options: ['Daily', 'Several times a week', 'Once a week', 'Once or twice a month', 'Less often'], required: true, category: 'purchase' },
  { id: 'q11', text: 'How would you rate the product name and branding?', type: 'scale', required: false, category: 'appeal' },
  { id: 'q12', text: 'How well does the product packaging concept appeal to you?', type: 'scale', required: false, category: 'appeal' },
  { id: 'q13', text: 'How confident are you that this product would taste as described?', type: 'scale', required: true, category: 'attributes' },
  { id: 'q14', text: 'Compared to current options available, this product offers better value.', type: 'scale', required: true, category: 'purchase' },
  { id: 'q15', text: 'What would most motivate you to try this product for the first time?', type: 'open_text', required: false, category: 'attributes' },
  { id: 'q16', text: 'What concerns, if any, do you have about this product?', type: 'open_text', required: false, category: 'attributes' },
  { id: 'q17', text: 'Who in your household would primarily consume this product?', type: 'multiple_choice', options: ['Myself', 'Children', 'Partner/spouse', 'Whole household', 'Guests'], required: false, category: 'demographics' },
  { id: 'q18', text: 'How important is it to you that this product is plant-based / vegan?', type: 'scale', required: false, category: 'attributes' },
  { id: 'q19', text: 'How important is the nutritional profile of this product to your purchase decision?', type: 'scale', required: true, category: 'attributes' },
  { id: 'q20', text: 'Where would you expect to find this product for sale?', type: 'multiple_choice', options: ['Grocery store', 'Specialty / health food store', 'Online', 'Farmers market', 'Restaurant/foodservice'], required: false, category: 'usage' },
  { id: 'q21', text: 'How likely are you to recommend this product to a friend or family member?', type: 'scale', required: true, category: 'purchase' },
  { id: 'q22', text: 'How does this product compare to your preferred current alternative?', type: 'scale', required: false, category: 'attributes' },
  { id: 'q23', text: 'What flavor or variety would you most want to see in this product line?', type: 'open_text', required: false, category: 'attributes' },
  { id: 'q24', text: 'How important is the product\'s ingredient list to your purchase decision?', type: 'scale', required: false, category: 'attributes' },
  { id: 'q25', text: 'Please rank the following product attributes in order of importance to you:', type: 'ranking', options: ['Taste', 'Price', 'Nutrition', 'Convenience', 'Sustainability'], required: false, category: 'attributes' },
  { id: 'q26', text: 'How would you describe your interest in this product to someone else?', type: 'open_text', required: false, category: 'appeal' },
  { id: 'q27', text: 'What age range do you fall into?', type: 'multiple_choice', options: ['18–24', '25–34', '35–44', '45–54', '55–64', '65+'], required: false, category: 'demographics' },
  { id: 'q28', text: 'How would you describe your diet?', type: 'multiple_choice', options: ['No restrictions', 'Vegetarian', 'Vegan', 'Flexitarian', 'Gluten-free', 'Other'], required: false, category: 'demographics' },
  { id: 'q29', text: 'How often do you currently purchase products in this category?', type: 'multiple_choice', options: ['Multiple times per week', 'Weekly', 'Monthly', 'A few times a year', 'Rarely/never'], required: true, category: 'usage' },
  { id: 'q30', text: 'Any additional feedback you would like to share about this concept?', type: 'open_text', required: false, category: 'attributes' },
];

const CATEGORY_COLORS: Record<Question['category'], string> = {
  appeal:       'bg-blue-100 text-blue-700',
  purchase:     'bg-emerald-100 text-emerald-700',
  price:        'bg-amber-100 text-amber-700',
  attributes:   'bg-purple-100 text-purple-700',
  demographics: 'bg-slate-100 text-slate-700',
  usage:        'bg-rose-100 text-rose-700',
};

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  scale: '1–9 Scale',
  multiple_choice: 'Multiple Choice',
  open_text: 'Open Text',
  ranking: 'Ranking',
};

// ─── Step components ─────────────────────────────────────────────────────────

function ConceptStep({ draft, onChange }: { draft: ConceptDraft; onChange: (d: ConceptDraft) => void }) {
  const set = (field: keyof ConceptDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({ ...draft, [field]: e.target.value });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Define your concept</h2>
        <p className="text-slate-500 text-sm mt-1">Describe the product you want consumers to evaluate.</p>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div className="space-y-1.5">
          <Label className="font-medium">Product name <span className="text-rose-500">*</span></Label>
          <Input value={draft.name} onChange={set('name')} placeholder="e.g. Vitacheeze Original Cheddar" />
        </div>
        <div className="space-y-1.5">
          <Label className="font-medium">Category <span className="text-rose-500">*</span></Label>
          <Input value={draft.category} onChange={set('category')} placeholder="e.g. Plant-based cheese, Artisan bread" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="font-medium">Concept description <span className="text-rose-500">*</span></Label>
        <Textarea
          value={draft.description}
          onChange={set('description')}
          placeholder="Describe the product concept as you'd present it to a consumer — ingredients, format, occasion, key claims…"
          rows={4}
          className="resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div className="space-y-1.5">
          <Label className="font-medium flex items-center gap-1.5"><Target className="size-3.5" /> Target market</Label>
          <Input value={draft.targetMarket} onChange={set('targetMarket')} placeholder="e.g. Health-conscious adults 25–45" />
        </div>
        <div className="space-y-1.5">
          <Label className="font-medium flex items-center gap-1.5"><DollarSign className="size-3.5" /> Expected price point</Label>
          <Input value={draft.pricePoint} onChange={set('pricePoint')} placeholder="e.g. $6.99 / 200g block" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="font-medium flex items-center gap-1.5"><Star className="size-3.5" /> Key consumer benefits</Label>
        <Textarea
          value={draft.keyBenefits}
          onChange={set('keyBenefits')}
          placeholder="e.g. Melts like dairy, high-protein (10g/serving), allergen-free, sustainable sourcing…"
          rows={2}
          className="resize-none"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="font-medium flex items-center gap-1.5"><Package className="size-3.5" /> Technical challenges / R&D notes</Label>
        <Textarea
          value={draft.technicalChallenges}
          onChange={set('technicalChallenges')}
          placeholder="e.g. Achieving melt properties from cashew base, protein source binding, shelf stability…"
          rows={2}
          className="resize-none"
        />
        <p className="text-xs text-slate-400">Internal only — not shown to panelists.</p>
      </div>

      <div className="space-y-3">
        <Label className="font-medium flex items-center gap-1.5">
          <ImageIcon className="size-3.5" /> Marketing images
          <span className="text-slate-400 font-normal text-xs">— shown to panelists for evaluation</span>
        </Label>
        {draft.marketingImages.map((url, i) => (
          <div key={i} className="flex gap-2 items-center">
            <Input
              value={url}
              onChange={(e) => {
                const next = [...draft.marketingImages];
                next[i] = e.target.value;
                onChange({ ...draft, marketingImages: next });
              }}
              placeholder="https://… (packaging mockup, ad concept, branding)"
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => onChange({ ...draft, marketingImages: draft.marketingImages.filter((_, j) => j !== i) })}
              className="text-slate-300 hover:text-rose-500 flex-shrink-0"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange({ ...draft, marketingImages: [...draft.marketingImages, ''] })}
          className="text-slate-600"
        >
          <Plus className="size-3.5 mr-1" /> Add marketing image
        </Button>
        {draft.marketingImages.filter(u => u.trim()).length > 0 && (
          <div className="flex gap-3 flex-wrap mt-2">
            {draft.marketingImages.filter(u => u.trim()).map((url, i) => (
              <div key={i} className="rounded-lg overflow-hidden border border-slate-200 shadow-sm">
                <img src={url} alt={`Marketing concept ${i + 1}`} className="w-40 h-28 object-cover" />
                <div className="px-2 py-1 bg-slate-50 text-[10px] text-slate-500 text-center font-medium">
                  Concept {i + 1}
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-slate-400">
          Add packaging mockups, ad concepts, or branding images. Panelists will view and evaluate these.
        </p>
      </div>
    </div>
  );
}

function QuestionsStep({
  questions,
  onChange,
}: {
  questions: Question[];
  onChange: (qs: Question[]) => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => {
      onChange(AI_QUESTION_TEMPLATES.slice(0, 20));
      setGenerating(false);
      setGenerated(true);
    }, 1400);
  };

  const remove = (id: string) => onChange(questions.filter(q => q.id !== id));

  const addBlank = () => {
    const id = `q_custom_${Date.now()}`;
    onChange([...questions, { id, text: '', type: 'scale', required: false, category: 'attributes' }]);
  };

  const update = (id: string, field: keyof Question, value: string | boolean) => {
    onChange(questions.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Design your survey</h2>
          <p className="text-slate-500 text-sm mt-1">
            {questions.length} question{questions.length !== 1 ? 's' : ''} — aim for 20–30 for reliable insights.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={addBlank}
            className="text-slate-700 border-slate-300"
          >
            <Plus className="size-3.5 mr-1" />
            Add question
          </Button>
          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={generating}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Sparkles className="size-3.5 mr-1.5" />
            {generating ? 'Generating…' : generated ? 'Regenerate with AI' : 'Generate with AI'}
          </Button>
        </div>
      </div>

      {questions.length === 0 && (
        <Card className="border-2 border-dashed border-blue-200 bg-blue-50">
          <CardContent className="py-12 text-center">
            <Sparkles className="size-10 text-blue-300 mx-auto mb-3" />
            <p className="text-blue-700 font-semibold">No questions yet</p>
            <p className="text-blue-500 text-sm mt-1">
              Click <strong>Generate with AI</strong> to create a tailored 20-question survey, or add questions manually.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {questions.map((q, i) => (
          <Card key={q.id} className="border border-slate-200 hover:border-slate-300 transition-colors">
            <CardContent className="py-3 px-4">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-1 mt-1 text-slate-300">
                  <GripVertical className="size-4" />
                  <span className="text-[11px] font-bold text-slate-400">{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <Input
                    value={q.text}
                    onChange={(e) => update(q.id, 'text', e.target.value)}
                    placeholder="Question text…"
                    className="border-0 px-0 py-0 h-auto text-sm font-medium text-slate-900 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-slate-400"
                  />
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[q.category]}`}>
                      {q.category}
                    </span>
                    <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                      {QUESTION_TYPE_LABELS[q.type]}
                    </span>
                    {q.required && (
                      <span className="text-[10px] font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">Required</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => remove(q.id)}
                  className="mt-1 text-slate-300 hover:text-rose-500 transition-colors flex-shrink-0"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {questions.length > 0 && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={addBlank} className="text-slate-600">
            <Plus className="size-3.5 mr-1.5" />
            Add another question
          </Button>
        </div>
      )}

      {/* Category legend */}
      {questions.length > 0 && (
        <Card className="border border-slate-100 bg-slate-50">
          <CardContent className="py-3 px-4">
            <p className="text-xs font-semibold text-slate-600 mb-2">Question categories</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(CATEGORY_COLORS).map(([cat, cls]) => (
                <span key={cat} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>
                  {cat}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PanelStep({
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
  const [registeredPanelists, setRegisteredPanelists] = useState<PanelistInfo[]>([]);

  useEffect(() => {
    fetchPanelists().then(setRegisteredPanelists).catch(() => {});
  }, []);

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
        <Label className="font-medium text-sm mb-3 block">Consumer segments to target</Label>
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
          Select specific panelists — they will see this concept test in their dashboard.
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
                Selected panelists will see this concept test in their dashboard alongside food evaluations. If no panelists are selected, the test targets panelists matching the consumer segments above.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReviewStep({ draft, questions, panelSize, segments, assignedPanelistIds }: {
  draft: ConceptDraft;
  questions: Question[];
  panelSize: number;
  segments: string[];
  assignedPanelistIds: string[];
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Review & launch</h2>
        <p className="text-slate-500 text-sm mt-1">Confirm everything looks right before sending to your panel.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardContent className="pt-4 pb-4 text-center">
            <div className="text-3xl font-black text-blue-600">{questions.length}</div>
            <div className="text-xs text-blue-700 font-medium mt-0.5">Questions</div>
          </CardContent>
        </Card>
        <Card className="border-2 border-emerald-200 bg-emerald-50">
          <CardContent className="pt-4 pb-4 text-center">
            <div className="text-3xl font-black text-emerald-600">
              {assignedPanelistIds.length > 0 ? assignedPanelistIds.length : panelSize}
            </div>
            <div className="text-xs text-emerald-700 font-medium mt-0.5">
              {assignedPanelistIds.length > 0 ? 'Assigned' : 'Target size'}
            </div>
          </CardContent>
        </Card>
        <Card className="border-2 border-amber-200 bg-amber-50">
          <CardContent className="pt-4 pb-4 text-center">
            <div className="text-3xl font-black text-amber-600">{Math.ceil(questions.length * 0.6)}</div>
            <div className="text-xs text-amber-700 font-medium mt-0.5">Est. minutes</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-slate-700">Concept</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-base font-bold text-slate-900">{draft.name || '(unnamed)'}</div>
          <div className="text-xs text-slate-500 mt-0.5">{draft.category}</div>
          {draft.description && <p className="text-sm text-slate-700 mt-2">{draft.description}</p>}
          <div className="flex flex-wrap gap-3 mt-3 text-xs text-slate-600">
            {draft.targetMarket && <span><strong>Target:</strong> {draft.targetMarket}</span>}
            {draft.pricePoint && <span><strong>Price:</strong> {draft.pricePoint}</span>}
            {draft.marketingImages.filter(u => u.trim()).length > 0 && (
              <span className="text-emerald-700 font-semibold">
                ✓ {draft.marketingImages.filter(u => u.trim()).length} marketing image{draft.marketingImages.filter(u => u.trim()).length !== 1 ? 's' : ''}
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ConceptTesting() {
  const [step, setStep] = useState<WizardStep>('concept');
  const [draft, setDraft] = useState<ConceptDraft>({
    name: '', category: '', description: '', marketingImages: [],
    targetMarket: '', pricePoint: '', keyBenefits: '', technicalChallenges: '',
  });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [panelSize, setPanelSize] = useState(50);
  const [segments, setSegments] = useState<string[]>([]);
  const [assignedPanelistIds, setAssignedPanelistIds] = useState<string[]>([]);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState('');

  const STEPS: WizardStep[] = ['concept', 'questions', 'panel', 'review'];
  const stepIndex = STEPS.indexOf(step);

  const conceptValid = draft.name.trim() && draft.category.trim() && draft.description.trim();

  const handleLaunch = async () => {
    setLaunching(true);
    setLaunchError('');
    try {
      await insertConceptTest({
        name: draft.name,
        category: draft.category,
        description: draft.description,
        imageUrls: draft.marketingImages.filter(u => u.trim()),
        targetMarket: draft.targetMarket,
        pricePoint: draft.pricePoint,
        keyBenefits: draft.keyBenefits,
        questions,
        panelSize,
        assignedPanelistIds,
        status: 'active',
      });
      setStep('launched');
    } catch {
      setLaunchError('Failed to launch. Please check your connection and try again.');
    } finally {
      setLaunching(false);
    }
  };

  if (step === 'launched') {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="size-10 text-emerald-600" />
        </div>
        <h2 className="text-3xl font-black text-slate-900">Concept test launched!</h2>
        <p className="text-slate-500 text-lg">
          Your survey has been sent to <strong>{panelSize} panelists</strong>.
          Results will appear in <strong>Analyze Results</strong> as responses come in.
        </p>
        <div className="flex items-center justify-center gap-3 pt-4">
          <Button
            variant="outline"
            onClick={() => { setStep('concept'); setDraft({ name:'',category:'',description:'',marketingImages:[],targetMarket:'',pricePoint:'',keyBenefits:'',technicalChallenges:'' }); setQuestions([]); setSegments([]); setAssignedPanelistIds([]); setPanelSize(50); }}
          >
            New concept test
          </Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
            View responses
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
          <Lightbulb className="size-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900">Concept Testing</h1>
          <p className="text-slate-500 text-sm">Design consumer surveys to validate product concepts before launch.</p>
        </div>
        <Badge className="ml-auto bg-slate-900 text-white text-xs font-bold">Pro</Badge>
      </div>

      {/* Step progress */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => {
          const done = i < stepIndex;
          const active = s === step;
          const labels: Record<WizardStep, string> = {
            concept: '1. Concept', questions: '2. Questions', panel: '3. Panel', review: '4. Review', launched: '',
          };
          return (
            <div key={s} className="flex items-center flex-1">
              <div className={`flex-1 flex items-center justify-center py-2 px-3 text-xs font-semibold transition-all ${
                done    ? 'bg-emerald-600 text-white' :
                active  ? 'bg-blue-600 text-white' :
                          'bg-slate-100 text-slate-400'
              } ${i === 0 ? 'rounded-l-lg' : ''} ${i === STEPS.length - 1 ? 'rounded-r-lg' : ''}`}>
                {done ? <CheckCircle2 className="size-3.5 mr-1" /> : null}
                {labels[s]}
              </div>
              {i < STEPS.length - 1 && <div className="w-0.5 h-9 bg-white" />}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <Card className="border-2 border-slate-200">
        <CardContent className="pt-6 pb-6">
          {step === 'concept'    && <ConceptStep draft={draft} onChange={setDraft} />}
          {step === 'questions'  && <QuestionsStep questions={questions} onChange={setQuestions} />}
          {step === 'panel'      && <PanelStep panelSize={panelSize} setPanelSize={setPanelSize} targetSegments={segments} setTargetSegments={setSegments} assignedPanelistIds={assignedPanelistIds} setAssignedPanelistIds={setAssignedPanelistIds} />}
          {step === 'review'     && <ReviewStep draft={draft} questions={questions} panelSize={panelSize} segments={segments} assignedPanelistIds={assignedPanelistIds} />}
        </CardContent>
      </Card>

      {launchError && (
        <p className="text-sm text-rose-600 font-medium text-center">{launchError}</p>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setStep(STEPS[stepIndex - 1])}
          disabled={stepIndex === 0}
          className="gap-1.5"
        >
          <ChevronLeft className="size-4" /> Back
        </Button>

        {step === 'review' ? (
          <Button
            onClick={handleLaunch}
            disabled={launching || questions.length === 0 || !conceptValid}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 px-8"
          >
            <Send className="size-4" />
            {launching ? 'Launching…' : 'Launch concept test'}
          </Button>
        ) : (
          <Button
            onClick={() => setStep(STEPS[stepIndex + 1])}
            disabled={step === 'concept' && !conceptValid}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
          >
            Continue <ChevronRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

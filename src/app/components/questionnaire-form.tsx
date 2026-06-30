import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Progress } from './ui/progress';
import { useAuth } from '../contexts/auth-context';
import { ESSENSE25_EMOTIONS, getDefaultCataAttributes, type Product } from '../data/survey-domain';
import { fetchProduct, fetchLatestUserResponse, insertResponse, markPanelistKitSubmitted } from '../lib/database';
import { CATA_DEFINITIONS, INTENSITY_DEFINITIONS, HEDONIC_DEFINITIONS, EMOTION_DEFINITIONS } from '../data/attribute-definitions';
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Edit2 } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { AttributeTooltip } from './attribute-tooltip';
import { getBlindStudyDisplayName } from '../lib/blind-study';
import { useScrollToTop } from '../lib/use-scroll-to-top';
import { queryClient } from '../lib/query-client';
import { queryKeys } from '../lib/hooks';

function sliderFill(value: number, min: number, max: number, color: string): React.CSSProperties {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return { background: `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, #e2e8f0 ${pct}%, #e2e8f0 100%)` };
}

const SLIDER_MIN = 1;
const SLIDER_MAX = 9;
const SLIDER_MIDPOINT = 5;

type FormData = {
  selectedCata: string[];
  intensityRatings: Record<string, number>;
  hedonicScores: {
    overall: number;
    appearance: number;
    aroma: number;
    flavor: number;
    texture: number;
  };
  emotions: Record<string, number>;
  comments: string;
};

export function QuestionnaireForm() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  useScrollToTop(productId);

  const [product, setProduct] = useState<Product | null>(null);
  const [productLoading, setProductLoading] = useState(true);
  const [showIntro, setShowIntro] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);
  const [existingResponseDate, setExistingResponseDate] = useState<string | null>(null);
  const [showDraftBanner, setShowDraftBanner] = useState(false);

  // Form state
  const [formData, setFormData] = useState<FormData>({
    selectedCata: [],
    intensityRatings: {},
    hedonicScores: {
      overall: 5,
      appearance: 5,
      aroma: 5,
      flavor: 5,
      texture: 5,
    },
    emotions: {},
    comments: '',
  });

  const initialLoadComplete = useRef(false);
  const [submitError, setSubmitError] = useState('');

  const cataAttributes = product?.customAttributes || getDefaultCataAttributes(product?.category ?? '');
  // Intensity only shows attributes the panelist selected in CATA
  const intensityAttributes = formData.selectedCata.length > 0 ? formData.selectedCata : [];
  const emotionAttributes = [...ESSENSE25_EMOTIONS.positive, ...ESSENSE25_EMOTIONS.negative];
  const totalSteps = 5;

  // Load product from Supabase
  useEffect(() => {
    if (!productId) return;
    fetchProduct(productId)
      .then(p => { setProduct(p); setProductLoading(false); })
      .catch(() => setProductLoading(false));
  }, [productId]);

  // Load existing response or draft — DB check runs first; draft restore only fires if no DB response
  useEffect(() => {
    if (!user?.id || !productId) return;
    fetchLatestUserResponse(user.id, productId).then(existing => {
      if (existing) {
        setExistingResponseDate(existing.timestamp);
        setFormData({
          selectedCata: existing.cataAttributes || [],
          intensityRatings: existing.intensityRatings || {},
          hedonicScores: existing.hedonicScores || { overall: 5, appearance: 5, aroma: 5, flavor: 5, texture: 5 },
          emotions: existing.emotionalProfile || {},
          comments: existing.comments || '',
        });
        setShowIntro(false);
        setAlreadyCompleted(true);
      } else {
        const draftKey = `qs_draft_${user.id}_${productId}`;
        const draft = sessionStorage.getItem(draftKey) ?? localStorage.getItem(draftKey);
        if (draft) {
          try {
            setFormData(JSON.parse(draft) as FormData);
            setShowDraftBanner(true);
            localStorage.removeItem(draftKey);
          } catch { /* ignore invalid JSON */ }
        }
      }
    }).finally(() => {
      initialLoadComplete.current = true;
    });
  }, [productId, user?.id]);

  // Persist draft on every formData change — guarded so we never overwrite a real draft on mount
  useEffect(() => {
    if (!productId || !user?.id || !initialLoadComplete.current) return;
    sessionStorage.setItem(`qs_draft_${user?.id}_${productId}`, JSON.stringify(formData));
  }, [formData, productId, user?.id]);

  const handleCataToggle = (attr: string) => {
    setFormData(prev => ({
      ...prev,
      selectedCata: prev.selectedCata.includes(attr)
        ? prev.selectedCata.filter(a => a !== attr)
        : [...prev.selectedCata, attr]
    }));
  };

  const handleIntensityChange = (attr: string, value: number) => {
    setFormData(prev => ({
      ...prev,
      intensityRatings: { ...prev.intensityRatings, [attr]: value }
    }));
  };

  const handleHedonicChange = (aspect: string, value: number) => {
    setFormData(prev => ({
      ...prev,
      hedonicScores: { ...prev.hedonicScores, [aspect]: value }
    }));
  };

  const handleEmotionChange = (emotion: string, value: number) => {
    setFormData(prev => ({
      ...prev,
      emotions: { ...prev.emotions, [emotion]: value }
    }));
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
      window.scrollTo(0, 0);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo(0, 0);
    }
  };

  const handleSubmit = async () => {
    if (!user?.id || !productId) return;
    setSubmitError('');
    if (user.role !== 'panelist') {
      setSubmitError('Preview mode only. Sign in as a panelist to submit a response.');
      return;
    }
    const completedIntensityRatings = Object.fromEntries(
      intensityAttributes.map(attr => [attr, formData.intensityRatings[attr] ?? SLIDER_MIDPOINT]),
    );
    const completedEmotionalProfile = Object.fromEntries(
      emotionAttributes.map(emotion => [emotion, formData.emotions[emotion] ?? SLIDER_MIDPOINT]),
    );
    try {
      await insertResponse({
        userId: user.id,
        productId,
        cataAttributes: formData.selectedCata,
        intensityRatings: completedIntensityRatings,
        hedonicScores: formData.hedonicScores,
        emotionalProfile: completedEmotionalProfile,
        comments: formData.comments,
        sampleCode: product?.blinded ? product.blindCode ?? undefined : undefined,
        presentationOrder: product?.blinded && product.blindCode ? [product.blindCode] : undefined,
      });
      const kitToken = sessionStorage.getItem(`panelist_kit_token_${productId}`);
      const manualCode = sessionStorage.getItem(`panelist_kit_manual_code_${productId}`);
      if (kitToken || manualCode) {
        await markPanelistKitSubmitted({ token: kitToken, manualCode });
        sessionStorage.removeItem(`panelist_kit_token_${productId}`);
        sessionStorage.removeItem(`panelist_kit_manual_code_${productId}`);
      }
      sessionStorage.removeItem(`qs_draft_${user?.id}_${productId}`);
      localStorage.removeItem(`qs_draft_${user?.id}_${productId}`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.userResponses(user.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.allResponses }),
      ]);
      setSubmitted(true);
      setTimeout(() => navigate('/panelist'), 3000);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save response. Please try again.');
    }
  };

  const jumpToStep = (step: number) => {
    setCurrentStep(step);
    window.scrollTo(0, 0);
  };

  if (productLoading) {
    return <div className="max-w-4xl mx-auto p-8 text-slate-500">Loading…</div>;
  }

  if (showIntro && product) {
    const displayName = getBlindStudyDisplayName(product);

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="border border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-2xl">Before You Begin: {displayName}</CardTitle>
            <p className="text-slate-600 mt-1">A quick guide to the scales you'll use in this evaluation</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="font-bold text-slate-900 mb-2">Step 1 — Flavor Attributes</div>
                <p className="text-sm text-slate-600 mb-3">Check every attribute you can perceive in the sample. There are no right or wrong answers.</p>
                <div className="flex gap-2 flex-wrap">
                  {['Creamy', 'Nutty', 'Salty'].map(a => (
                    <span key={a} className="px-2 py-1 bg-white border border-slate-200 text-slate-700 rounded text-xs font-medium">{a}</span>
                  ))}
                  <span className="text-xs text-slate-400 self-center">etc.</span>
                </div>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="font-bold text-slate-900 mb-2">Steps 2 & 3 — Rating Scales</div>
                <p className="text-sm text-slate-600 mb-3">Intensity and liking use a <strong>1–9 scale</strong>. Left end is lowest, right end is highest.</p>
                <div className="space-y-2">
                  <div>
                    <div className="text-xs font-medium text-slate-500 mb-1">Intensity example (1–9):</div>
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>1 = Not present</span><span>9 = Extremely intense</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 mt-1"><div className="bg-slate-700 h-2 rounded-full w-1/2" /></div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-500 mb-1">Liking example (1–9):</div>
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>1 = Dislike</span><span>9 = Like</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 mt-1"><div className="bg-slate-700 h-2 rounded-full w-8/9" /></div>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="font-bold text-slate-900 mb-2">Step 4 — Emotions</div>
                <p className="text-sm text-slate-600 mb-3">Rate how strongly you feel each emotion <em>right now</em>, after tasting.</p>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>1 = Not at all</span><span>9 = Very strongly</span>
                </div>
                <p className="text-xs text-slate-400 mt-2">Higher = you feel it more strongly. This applies to both positive and negative emotions.</p>
              </div>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-700">
              <strong>Tip:</strong> Hover over any underlined term <span className="underline decoration-dotted cursor-help" title="Exactly — this is how definitions appear.">like this</span> to see its definition.
            </div>
            <Button
              onClick={() => setShowIntro(false)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-lg py-6"
            >
              Begin Evaluation →
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>Product not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  const displayName = getBlindStudyDisplayName(product);

  if (product.status === 'completed') {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="border-2 border-slate-300 bg-slate-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-700">
              <AlertCircle className="size-6 text-slate-500" />
              Evaluation Session Closed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-700">
              This evaluation session is closed. The study administrator has marked{' '}
              <strong>{displayName}</strong> as complete. No further submissions are being accepted.
            </p>
            <Button variant="outline" onClick={() => navigate('/panelist')}>
              <ChevronLeft className="size-4 mr-2" />
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="border-2 border-emerald-300 bg-emerald-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-6 text-emerald-600" />
              Response Submitted Successfully!
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-700 mb-2">
              Thank you for completing the evaluation for <strong>{displayName}</strong>.
            </p>
            <p className="text-sm text-slate-600">Redirecting to dashboard...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const progressPercent = (currentStep / totalSteps) * 100;

  return (
    <div className="max-w-4xl mx-auto space-y-4 px-3 pb-24 sm:px-0 sm:space-y-6">
      {/* Header with Progress */}
      <Card className="border border-slate-200 bg-white">
        <CardHeader>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <CardTitle className="text-2xl">Product Evaluation</CardTitle>
              <div className="space-y-1 text-sm text-slate-600 mt-2">
                <p><strong>{product.blinded ? 'Sample' : 'Product'}:</strong> {displayName}</p>
                <p><strong>Your ID:</strong> {user?.panelistId}</p>
              </div>
            </div>
            <div className="shrink-0 text-right">
                <div className="text-2xl font-bold text-slate-900 sm:text-3xl">
                {currentStep}/{totalSteps}
              </div>
              <div className="text-xs text-slate-600 mt-1">Steps</div>
            </div>
          </div>
          <div className="space-y-2">
            <Progress value={progressPercent} className="h-2" />
            <div className="text-xs text-slate-600 text-center">
              {currentStep === 1 && 'CATA Attributes'}
              {currentStep === 2 && 'Intensity Ratings'}
              {currentStep === 3 && 'Hedonic Scores'}
              {currentStep === 4 && 'Emotional Response'}
              {currentStep === 5 && 'Review & Submit'}
            </div>
          </div>
        </CardHeader>
      </Card>

      {alreadyCompleted && currentStep === 1 && (
        <Alert className="border-slate-300 bg-slate-50">
          <Edit2 className="size-4" />
          <AlertDescription>
            You completed this evaluation on{' '}
            {existingResponseDate ? new Date(existingResponseDate).toLocaleDateString() : 'a previous date'}.
            {' '}Submit again to record a new run.
          </AlertDescription>
        </Alert>
      )}

      {showDraftBanner && currentStep === 1 && (
        <Alert className="border-amber-300 bg-amber-50">
          <AlertCircle className="size-4 text-amber-600" />
          <AlertDescription className="flex items-center justify-between">
            <span>You have a saved draft for this product. Your answers have been restored.</span>
            <button
              onClick={() => {
                sessionStorage.removeItem(`qs_draft_${user?.id}_${productId}`);
                localStorage.removeItem(`qs_draft_${user?.id}_${productId}`);
                setFormData({ selectedCata: [], intensityRatings: {}, hedonicScores: { overall: 5, appearance: 5, aroma: 5, flavor: 5, texture: 5 }, emotions: {}, comments: '' });
                setShowDraftBanner(false);
              }}
              className="ml-4 text-xs text-amber-700 underline hover:text-amber-900 whitespace-nowrap"
            >
              Clear draft
            </button>
          </AlertDescription>
        </Alert>
      )}

      {/* Step 1: CATA */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Flavor & Aroma Attributes (CATA)</CardTitle>
            <p className="text-sm text-slate-600">
              Select ALL attributes that you perceive in this sample. Hover over any attribute for its definition.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              {cataAttributes.map(attr => (
                <div key={attr} className="flex items-center space-x-2">
                  <Checkbox
                    id={`cata-${attr}`}
                    checked={formData.selectedCata.includes(attr)}
                    onCheckedChange={() => handleCataToggle(attr)}
                  />
                  <Label htmlFor={`cata-${attr}`} className="text-sm cursor-pointer">
                    <AttributeTooltip
                      term={attr}
                      definition={CATA_DEFINITIONS[attr] || 'Sensory attribute'}
                    />
                  </Label>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-sm text-slate-600">
                <strong>Selected:</strong> {formData.selectedCata.length} attributes
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Intensity */}
      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Intensity Ratings</CardTitle>
            <p className="text-sm text-slate-600">
              Rate how intense each attribute is. These are the attributes you selected in Step 1.
            </p>
            <div className="mt-2 flex justify-between text-xs text-slate-400 bg-slate-50 rounded px-3 py-1.5">
              <span>Scale: 1 = Not present</span><span>5 = Extremely intense</span>
            </div>
          </CardHeader>
          <CardContent>
            {intensityAttributes.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">
                No attributes selected in Step 1. Go back and select the flavors you perceived.
              </div>
            ) : (
              <div className="space-y-6">
                {intensityAttributes.map(attr => (
                  <div key={attr} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>
                        <AttributeTooltip
                          term={attr}
                          definition={INTENSITY_DEFINITIONS[attr] || CATA_DEFINITIONS[attr] || 'Rate the intensity of this attribute'}
                        />
                      </Label>
                      <span className="text-sm font-bold text-slate-900">
                        {formData.intensityRatings[attr] ?? SLIDER_MIDPOINT}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={SLIDER_MIN}
                      max={SLIDER_MAX}
                      step="1"
                      value={formData.intensityRatings[attr] ?? SLIDER_MIDPOINT}
                      onChange={(e) => handleIntensityChange(attr, parseInt(e.target.value))}
                      style={sliderFill(formData.intensityRatings[attr] ?? SLIDER_MIDPOINT, SLIDER_MIN, SLIDER_MAX, '#334155')}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-slate-700"
                    />
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>1 — Not present</span>
                      <span>5 — Moderate</span>
                      <span>9 — Extremely intense</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Hedonic */}
      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Overall Liking</CardTitle>
            <p className="text-sm text-slate-600">
              Rate how much you like or dislike each aspect of the product.
            </p>
            <div className="mt-2 flex justify-between text-xs text-slate-400 bg-slate-50 rounded px-3 py-1.5">
              <span>Scale: 1 = Dislike extremely</span><span>9 = Like extremely</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {Object.entries(formData.hedonicScores).map(([aspect, value]) => (
                <div key={aspect} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="capitalize">
                      <AttributeTooltip
                        term={aspect.replace(/([A-Z])/g, ' $1').trim()}
                        definition={HEDONIC_DEFINITIONS[aspect] || 'Rate your liking'}
                      />
                    </Label>
                    <span className="text-sm font-bold text-slate-900">{value} / 9</span>
                  </div>
                  <input
                    type="range"
                    min={SLIDER_MIN}
                    max={SLIDER_MAX}
                    step="1"
                    value={value}
                    onChange={(e) => handleHedonicChange(aspect, parseInt(e.target.value))}
                    style={sliderFill(value, SLIDER_MIN, SLIDER_MAX, '#334155')}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-slate-700"
                  />
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>1 — Dislike extremely</span>
                    <span>5 — Neither</span>
                    <span>9 — Like extremely</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Emotions */}
      {currentStep === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 4: Emotional Response</CardTitle>
            <p className="text-sm text-slate-600">
              Rate how strongly you feel each emotion <strong>right now</strong>, after tasting this product.
            </p>
            <div className="mt-2 flex justify-between text-xs text-slate-400 bg-slate-50 rounded px-3 py-1.5">
              <span>1 = Not at all</span><span>9 = Very strongly</span>
            </div>
            <p className="text-xs text-amber-700 bg-amber-50 rounded px-3 py-1.5 mt-1">
              Higher numbers mean you feel that emotion more strongly — this applies to both positive and negative emotions.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Positive Emotions */}
              <div>
                <h4 className="font-bold text-emerald-700 mb-4">Positive Emotions</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ESSENSE25_EMOTIONS.positive.map(emotion => (
                    <div key={emotion} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">
                          <AttributeTooltip
                            term={emotion}
                            definition={EMOTION_DEFINITIONS[emotion] || emotion}
                          />
                        </Label>
                        <span className="text-xs font-bold text-emerald-600">
                          {formData.emotions[emotion] ?? SLIDER_MIDPOINT}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={SLIDER_MIN}
                        max={SLIDER_MAX}
                        step="1"
                        value={formData.emotions[emotion] ?? SLIDER_MIDPOINT}
                        onChange={(e) => handleEmotionChange(emotion, parseInt(e.target.value))}
                        style={sliderFill(formData.emotions[emotion] ?? SLIDER_MIDPOINT, SLIDER_MIN, SLIDER_MAX, '#059669')}
                        className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Negative Emotions */}
              <div>
                <h4 className="font-bold text-rose-700 mb-4">Negative Emotions</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ESSENSE25_EMOTIONS.negative.map(emotion => (
                    <div key={emotion} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">
                          <AttributeTooltip
                            term={emotion}
                            definition={EMOTION_DEFINITIONS[emotion] || emotion}
                          />
                        </Label>
                        <span className="text-xs font-bold text-rose-600">
                          {formData.emotions[emotion] ?? SLIDER_MIDPOINT}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={SLIDER_MIN}
                        max={SLIDER_MAX}
                        step="1"
                        value={formData.emotions[emotion] ?? SLIDER_MIDPOINT}
                        onChange={(e) => handleEmotionChange(emotion, parseInt(e.target.value))}
                        style={sliderFill(formData.emotions[emotion] ?? SLIDER_MIDPOINT, SLIDER_MIN, SLIDER_MAX, '#e11d48')}
                        className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-rose-600"
                      />
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>1 — Not at all</span><span>9 — Very strongly</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Review */}
      {currentStep === 5 && (
        <div className="space-y-6">
          <Card className="border-2 border-emerald-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="size-6 text-emerald-600" />
                Step 5: Review Your Responses
              </CardTitle>
              <p className="text-sm text-slate-600">
                Please review your answers. Click on any section number to go back and make changes.
              </p>
            </CardHeader>
          </Card>

          {/* Review CATA */}
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => jumpToStep(1)}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-sm font-bold">1</span>
                  CATA Attributes
                </CardTitle>
                <Edit2 className="size-4 text-slate-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {formData.selectedCata.length > 0 ? (
                  formData.selectedCata.map(attr => (
                    <span key={attr} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm">
                      {attr}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-500 italic">No attributes selected</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Review Intensity */}
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => jumpToStep(2)}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-sm font-bold">2</span>
                  Intensity Ratings
                </CardTitle>
                <Edit2 className="size-4 text-slate-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {formData.selectedCata.length > 0 ? formData.selectedCata.map(attr => (
                  <div key={attr} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{attr}:</span>
                    <span className="font-bold text-slate-900">{formData.intensityRatings[attr] ?? SLIDER_MIDPOINT}/9</span>
                  </div>
                )) : (
                  <span className="text-sm text-slate-500 italic sm:col-span-2">No attributes rated</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Review Hedonic */}
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => jumpToStep(3)}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-sm font-bold">3</span>
                  Hedonic Scores
                </CardTitle>
                <Edit2 className="size-4 text-slate-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {Object.entries(formData.hedonicScores).map(([aspect, value]) => (
                  <div key={aspect} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700 capitalize">{aspect.replace(/([A-Z])/g, ' $1').trim()}:</span>
                    <span className="font-bold text-slate-900">{value}/9</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Review Emotions */}
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => jumpToStep(4)}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-sm font-bold">4</span>
                  Emotional Response
                </CardTitle>
                <Edit2 className="size-4 text-slate-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-bold text-emerald-700 mb-2">Positive Emotions:</p>
                  <div className="flex flex-wrap gap-2">
                    {ESSENSE25_EMOTIONS.positive
                      .map(emotion => (
                        <span key={emotion} className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs">
                          {emotion} ({formData.emotions[emotion] ?? SLIDER_MIDPOINT})
                        </span>
                      ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-rose-700 mb-2">Negative Emotions:</p>
                  <div className="flex flex-wrap gap-2">
                    {ESSENSE25_EMOTIONS.negative
                      .map(emotion => (
                        <span key={emotion} className="px-2 py-1 bg-rose-100 text-rose-700 rounded text-xs">
                          {emotion} ({formData.emotions[emotion] ?? SLIDER_MIDPOINT})
                        </span>
                      ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Open-ended comments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-sm font-bold">5</span>
                Additional Comments <span className="text-sm font-normal text-slate-400">(optional)</span>
              </CardTitle>
              <p className="text-sm text-slate-500">Anything else you'd like to share about this product? Explain your ratings or describe anything not captured above.</p>
            </CardHeader>
            <CardContent>
              <textarea
                className="w-full border border-slate-200 rounded-lg p-3 text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
                rows={4}
                maxLength={2000}
                placeholder="e.g. The texture was unusual compared to what I expected, or the coconut note was very subtle at first but grew stronger..."
                value={formData.comments}
                onChange={(e) => setFormData(prev => ({ ...prev, comments: e.target.value }))}
              />
            </CardContent>
          </Card>

          {/* Final Confirmation */}
        <div className="sticky bottom-0 z-20 -mx-3 space-y-3 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:mx-0 sm:rounded-t-lg sm:border">
              <Alert className="border-amber-300 bg-amber-50">
                <AlertCircle className="size-4" />
                <AlertDescription>
                  <strong>Are your responses accurate?</strong> Once submitted, you can still edit your response later if needed.
                </AlertDescription>
              </Alert>
              {submitError && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              )}
              <Button
                onClick={handleSubmit}
                className="w-full bg-slate-900 hover:bg-slate-800 text-base py-6 sm:text-lg"
              >
                <CheckCircle2 className="size-5 mr-2" />
                {alreadyCompleted ? 'Submit New Run' : 'Submit Questionnaire'}
              </Button>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className={`sticky bottom-0 z-20 -mx-3 gap-3 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:mx-0 sm:rounded-t-lg sm:border ${currentStep === totalSteps ? 'hidden' : 'flex'}`}>
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 1}
          className="flex-1 py-6"
        >
          <ChevronLeft className="size-4 mr-2" />
          Back
        </Button>
        {currentStep < totalSteps && (
          <Button
            onClick={handleNext}
            className="flex-1 bg-slate-900 hover:bg-slate-800 py-6"
          >
            Next
            <ChevronRight className="size-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}

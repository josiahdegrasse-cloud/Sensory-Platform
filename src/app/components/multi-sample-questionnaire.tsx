import { useMemo, useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { useAuth } from '../contexts/auth-context';
import { SURVEY_EMOTIONS, getDefaultCataAttributes, type Product } from '../data/survey-domain';
import { fetchProduct, fetchLatestUserResponse, insertResponseBatch, markPanelistKitSubmitted } from '../lib/database';
import { CATA_DEFINITIONS, INTENSITY_DEFINITIONS, HEDONIC_DEFINITIONS, EMOTION_DEFINITIONS, getCataDefinition } from '../data/attribute-definitions';
import { AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { AttributeTooltip } from './attribute-tooltip';
import { RangeScaleTicks } from './range-scale-ticks';
import { getBlindStudyCategoryLabel, getBlindStudyDisplayName, getPanelistSampleOrder } from '../lib/blind-study';
import { useScrollToTop } from '../lib/use-scroll-to-top';
import { queryClient } from '../lib/query-client';
import { queryKeys } from '../lib/hooks';
import { DEFAULT_SURVEY_SECTIONS } from '../lib/survey-sections';
import { PanelistSubmissionSuccess, PanelistTaskLoading, PanelistTaskUnavailable } from './panelist-task-state';
import { answeredNinePointValues } from '../lib/sensory-scales';

function sliderFill(value: number, min: number, max: number, color: string): React.CSSProperties {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return { background: `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, #e2e8f0 ${pct}%, #e2e8f0 100%)` };
}

const SLIDER_MIN = 1;
const SLIDER_MAX = 9;
const SLIDER_MIDPOINT = 5;
const PALATE_CLEANSE_SECONDS = 20;
const HEDONIC_ASPECTS = ['overall', 'appearance', 'aroma', 'flavor', 'texture'] as const;

function optionalSliderFill(value: number | undefined, color: string): React.CSSProperties {
  return value === undefined
    ? { background: '#e2e8f0' }
    : sliderFill(value, SLIDER_MIN, SLIDER_MAX, color);
}

type Step = 'intro' | 'sample' | 'cleanse' | 'discrimination' | 'confirmation' | 'submitted';

const DEFAULT_MULTI_SAMPLES = [
  { id: '1', code: '341', label: 'Sample 1' },
  { id: '2', code: '872', label: 'Sample 2' },
  { id: '3', code: '529', label: 'Sample 3' },
];

interface SampleResponse {
  sampleId: string;
  sampleCode: string;
  cataAttributes: string[];
  intensityRatings: Record<string, number>;
  hedonicScores: Partial<{ overall: number; appearance: number; aroma: number; flavor: number; texture: number }>;
  emotions: Record<string, number>;
  comments: string;
}

interface MultiSampleDraft {
  currentStep: Exclude<Step, 'submitted'>;
  currentSampleIndex: number;
  sampleResponses: SampleResponse[];
  selectedCata: string[];
  intensityRatings: Record<string, number>;
  hedonicScores: Partial<Record<(typeof HEDONIC_ASPECTS)[number], number>>;
  emotions: Record<string, number>;
  comments: string;
  differentSample: string;
}

export function MultiSampleQuestionnaire() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  useScrollToTop(productId);
  
  const [product, setProduct] = useState<Product | null>(null);
  const [productLoading, setProductLoading] = useState(true);
  const [productError, setProductError] = useState('');
  const [completionCheckLoading, setCompletionCheckLoading] = useState(true);
  const [completionCheckError, setCompletionCheckError] = useState('');

  useEffect(() => {
    if (!productId) return;
    fetchProduct(productId)
      .then(setProduct)
      .catch(() => setProductError('This study could not be loaded. Check your connection, or return to your task list and try again.'))
      .finally(() => setProductLoading(false));
  }, [productId]);

  // Multi-sample flow state
  const [currentStep, setCurrentStep] = useState<Step>('intro');
  const [currentSampleIndex, setCurrentSampleIndex] = useState(0);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);

  const samples = useMemo(() => {
    if (!product?.samples?.length) return DEFAULT_MULTI_SAMPLES;
    if (!product.blinded) return product.samples;
    return getPanelistSampleOrder(product.id, user?.id ?? user?.panelistId ?? '', product.samples);
  }, [product, user?.id, user?.panelistId]);
  
  // Responses for each sample
  const [sampleResponses, setSampleResponses] = useState<SampleResponse[]>([]);
  
  // Current sample form state
  const [selectedCata, setSelectedCata] = useState<string[]>([]);
  const [intensityRatings, setIntensityRatings] = useState<Record<string, number>>({});
  const [hedonicScores, setHedonicScores] = useState<Partial<Record<(typeof HEDONIC_ASPECTS)[number], number>>>({});
  const [emotions, setEmotions] = useState<Record<string, number>>({});
  const [comments, setComments] = useState('');
  
  // Discrimination question state
  const [differentSample, setDifferentSample] = useState<string>('');
  
  // Palate cleanse countdown
  const [cleanseCountdown, setCleanseCountdown] = useState(PALATE_CLEANSE_SECONDS);
  const cleanseIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [completionWarning, setCompletionWarning] = useState('');
  const [discriminationError, setDiscriminationError] = useState('');
  const draftLoadComplete = useRef(false);

  useEffect(() => {
    if (currentStep !== 'cleanse') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initialising an interval-timer countdown
    setCleanseCountdown(PALATE_CLEANSE_SECONDS);
    cleanseIntervalRef.current = setInterval(() => {
      setCleanseCountdown(prev => {
        if (prev <= 1) {
          clearInterval(cleanseIntervalRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (cleanseIntervalRef.current) clearInterval(cleanseIntervalRef.current); };
  }, [currentStep]);

  const cataAttributes = product?.customAttributes || getDefaultCataAttributes(product?.category ?? '');
  const configuredSections = product?.surveySections ?? DEFAULT_SURVEY_SECTIONS;
  // Intensity shows only what the panelist selected in CATA (same pattern as single-sample form)
  const intensityAttributes = selectedCata.length > 0 ? selectedCata : cataAttributes.slice(0, 8);
  const emotionAttributes = [...SURVEY_EMOTIONS.positive, ...SURVEY_EMOTIONS.negative];

  useEffect(() => {
    if (!user?.id || !productId) return;
    fetchLatestUserResponse(user.id, productId).then(existing => {
      if (existing) {
        setAlreadyCompleted(true);
        sessionStorage.removeItem(`multi_qs_draft_${user.id}_${productId}`);
        return;
      }
      const saved = sessionStorage.getItem(`multi_qs_draft_${user.id}_${productId}`);
      if (!saved) return;
      try {
        const draft = JSON.parse(saved) as MultiSampleDraft;
        setCurrentStep(draft.currentStep);
        setCurrentSampleIndex(draft.currentSampleIndex);
        setSampleResponses(draft.sampleResponses);
        setSelectedCata(draft.selectedCata);
        setIntensityRatings(draft.intensityRatings);
        setHedonicScores(previous => ({ ...previous, ...draft.hedonicScores }));
        setEmotions(draft.emotions);
        setComments(draft.comments);
        setDifferentSample(draft.differentSample);
      } catch {
        sessionStorage.removeItem(`multi_qs_draft_${user.id}_${productId}`);
      }
    }).catch(() => {
      setCompletionCheckError('We could not verify whether you already completed this task. Refresh before entering answers so a previous triangle result is not duplicated.');
    }).finally(() => {
      draftLoadComplete.current = true;
      setCompletionCheckLoading(false);
    });
  }, [productId, user?.id]);

  useEffect(() => {
    if (!user?.id || !productId || !draftLoadComplete.current || currentStep === 'intro' || currentStep === 'submitted' || alreadyCompleted) return;
    const draft: MultiSampleDraft = {
      currentStep,
      currentSampleIndex,
      sampleResponses,
      selectedCata,
      intensityRatings,
      hedonicScores,
      emotions,
      comments,
      differentSample,
    };
    sessionStorage.setItem(`multi_qs_draft_${user.id}_${productId}`, JSON.stringify(draft));
  }, [alreadyCompleted, comments, currentSampleIndex, currentStep, differentSample, emotions, hedonicScores, intensityRatings, productId, sampleResponses, selectedCata, user?.id]);

  const handleCataToggle = (attr: string) => {
    setSelectedCata(prev => 
      prev.includes(attr) ? prev.filter(a => a !== attr) : [...prev, attr]
    );
  };

  const handleIntensityChange = (attr: string, value: number) => {
    setIntensityRatings(prev => ({ ...prev, [attr]: value }));
  };

  const handleEmotionChange = (emotion: string, value: number) => {
    setEmotions(prev => ({ ...prev, [emotion]: value }));
  };

  const saveSampleResponse = () => {
    const completedIntensityRatings = configuredSections.includes('intensity')
      ? answeredNinePointValues(intensityAttributes, intensityRatings)
      : {};
    const completedEmotions = configuredSections.includes('emotions')
      ? answeredNinePointValues(emotionAttributes, emotions)
      : {};
    const response: SampleResponse = {
      sampleId: samples[currentSampleIndex].id,
      sampleCode: samples[currentSampleIndex].code,
      cataAttributes: configuredSections.includes('cata') ? selectedCata : [],
      intensityRatings: completedIntensityRatings,
      hedonicScores: configuredSections.includes('hedonic')
        ? answeredNinePointValues(HEDONIC_ASPECTS, hedonicScores)
        : {},
      emotions: completedEmotions,
      comments: configuredSections.includes('comments') ? comments : '',
    };
    
    setSampleResponses(prev => [...prev, response]);
    
    // Reset form for next sample
    setSelectedCata([]);
    setIntensityRatings({});
    setHedonicScores({});
    setEmotions({});
    setComments('');
  };

  const handleContinueFromSample = () => {
    saveSampleResponse();
    if (currentSampleIndex < samples.length - 1) {
      setCurrentStep('cleanse');
    } else {
      setCurrentStep('discrimination');
    }
  };

  const handleContinueFromCleanse = () => {
    setCurrentSampleIndex(prev => prev + 1);
    setCurrentStep('sample');
  };

  const handleContinueFromDiscrimination = () => {
    if (!differentSample) {
      setDiscriminationError('Please select which sample is different before continuing.');
      return;
    }
    setDiscriminationError('');
    setCurrentStep('confirmation');
  };

  const handleFinalSubmit = async () => {
    if (!user?.id || !productId) return;
    setIsSubmitting(true);
    setSubmitError('');
    if (user.role !== 'panelist') {
      setSubmitError('Preview mode only. Sign in as a panelist to submit a response.');
      setIsSubmitting(false);
      return;
    }
    try {
      let hasCompletionWarning = false;
      await insertResponseBatch(sampleResponses.map(response => ({
          userId: user.id,
          productId,
          cataAttributes: response.cataAttributes,
          intensityRatings: response.intensityRatings,
          hedonicScores: response.hedonicScores,
          emotionalProfile: response.emotions,
          sessionType: `${samples.length}-sample-sequential`,
          sampleCode: response.sampleCode,
          differentSample,
          ranking: [],
          presentationOrder: samples.map(sample => sample.code),
          comments: response.comments,
      })));
      const kitToken = sessionStorage.getItem(`panelist_kit_token_${productId}`);
      const manualCode = sessionStorage.getItem(`panelist_kit_manual_code_${productId}`);
      if (kitToken || manualCode) {
        try {
          await markPanelistKitSubmitted({ token: kitToken, manualCode });
          sessionStorage.removeItem(`panelist_kit_token_${productId}`);
          sessionStorage.removeItem(`panelist_kit_manual_code_${productId}`);
        } catch {
          hasCompletionWarning = true;
          setCompletionWarning('Your answers are saved, but the box status could not be updated. Keep the insert and tell the study team your box code.');
        }
      }
      sessionStorage.removeItem(`multi_qs_draft_${user.id}_${productId}`);
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.userResponses(user.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.allResponses }),
      ]);
      setCurrentStep('submitted');
      if (!hasCompletionWarning) setTimeout(() => navigate('/panelist'), 3000);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (productLoading) {
    return <PanelistTaskLoading message="Loading your tasting task…" />;
  }

  if (completionCheckLoading) {
    return <PanelistTaskLoading message="Checking your saved progress…" />;
  }

  if (completionCheckError) {
    return <PanelistTaskUnavailable message={completionCheckError} onRetry={() => window.location.reload()} onBack={() => navigate('/panelist')} />;
  }

  if (!product) {
    return <PanelistTaskUnavailable message={productError || 'This tasting task is not available. Return to your task list or contact the study team.'} onBack={() => navigate('/panelist')} />;
  }

  const displayName = getBlindStudyDisplayName(product);
  const categoryLabel = getBlindStudyCategoryLabel(product);

  if (product.status === 'completed') {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="border border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="size-6 text-slate-500" />
              This study is closed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-700">
              No further responses are being accepted for <strong>{displayName}</strong>.
            </p>
            <Button variant="outline" onClick={() => navigate('/panelist')}>Back to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (alreadyCompleted) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="border-2 border-amber-300 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="size-6 text-amber-600" />
              Already Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-700 mb-4">
              You have already completed the triangle test for <strong>{displayName}</strong>.
            </p>
            <Button onClick={() => navigate('/panelist')}>
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Introduction screen
  if (currentStep === 'intro') {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="border border-slate-200 bg-white">
          <CardHeader className="border-b border-slate-200 bg-white">
            <CardTitle className="text-2xl">Triangle Test</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div>
              <h3 className="font-bold text-slate-900 mb-2">Instructions:</h3>
              <ol className="list-decimal list-inside space-y-2 text-slate-700">
                <li>You will evaluate <strong>3 coded servings</strong> sequentially</li>
                <li>Each sample is identified only by a unique <strong>3-digit code</strong></li>
                <li>Complete the questionnaire for each sample before continuing</li>
                <li>After all samples, you will identify which coded serving is <strong>different</strong></li>
                <li>Review all responses before final submission</li>
              </ol>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-sm text-slate-900 font-medium mb-2 flex items-center gap-1.5">
                <AlertCircle className="size-3.5" />
                {product.blinded ? 'Blind Evaluation Protocol' : 'Coded Evaluation Protocol'}
              </p>
              <p className="text-sm text-slate-700">
                {product.blinded
                  ? 'Sample identities are concealed to ensure unbiased evaluation. You will only see 3-digit codes during this test. Do not discuss or attempt to identify samples.'
                  : 'Use the assigned 3-digit codes when answering sample and triangle-test questions.'}
              </p>
            </div>
            
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-slate-900">Session Information:</h4>
                {product.blinded ? (
                  <Badge variant="outline" className="border-slate-200 text-slate-700 text-xs tracking-wider">BLINDED</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-slate-700 border-slate-200 bg-white">UNBLINDED</Badge>
                )}
              </div>
              <div className="text-sm space-y-1 text-slate-700">
                <p><strong>Study:</strong> {displayName}</p>
                <p><strong>Category:</strong> {categoryLabel}</p>
                <p><strong>Panelist ID:</strong> {user?.panelistId}</p>
                <p><strong>Samples:</strong> {samples.length}</p>
                <p><strong>Estimated time:</strong> {15 + (samples.length - 3) * 5}-{20 + (samples.length - 3) * 5} minutes</p>
              </div>
            </div>
            
            <Button 
              onClick={() => setCurrentStep('sample')} 
              className="w-full bg-slate-900 hover:bg-slate-800 text-lg py-6"
            >
              Begin Evaluation
              <ChevronRight className="size-5 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Sample evaluation screen
  if (currentStep === 'sample') {
    const currentSample = samples[currentSampleIndex];
    const progress = Math.round(((currentSampleIndex + 1) / samples.length) * 100);
    
    return (
      <div className="max-w-4xl mx-auto space-y-4 px-3 pb-24 sm:px-0 sm:space-y-6">
        {/* Progress indicator */}
        <Card className="border border-slate-200 bg-white">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div>
                <h3 className="font-bold text-slate-900">Evaluating Sample: <span className="text-slate-900">{currentSample.code}</span></h3>
                <p className="text-sm text-slate-700">{currentSampleIndex + 1} of {samples.length} samples completed</p>
              </div>
              <div className="flex size-14 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-lg font-bold text-white sm:size-16 sm:text-xl">
                {currentSample.code}
              </div>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className="bg-slate-800 h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </CardContent>
        </Card>

        {/* CATA */}
        {configuredSections.includes('cata') && <Card>
          <CardHeader>
            <CardTitle>1. Flavor & Aroma Attributes (CATA)</CardTitle>
            <p className="text-sm text-slate-700">
              Select ALL attributes that you perceive in Sample {currentSample.code}. Hover over any attribute for its definition.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              {cataAttributes.map(attr => (
                <div key={attr} className="flex items-center space-x-2">
                  <Checkbox
                    id={`cata-${currentSampleIndex}-${attr}`}
                    checked={selectedCata.includes(attr)}
                    onCheckedChange={() => handleCataToggle(attr)}
                  />
                  <Label
                    htmlFor={`cata-${currentSampleIndex}-${attr}`}
                    className="text-sm cursor-pointer"
                  >
                    <AttributeTooltip
                      term={attr}
                      definition={getCataDefinition(attr, product?.category)}
                    />
                  </Label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>}

        {/* Intensity */}
        {configuredSections.includes('intensity') && <Card>
          <CardHeader>
            <CardTitle>2. Intensity Ratings</CardTitle>
            <p className="text-sm text-slate-700">
              Rate the intensity of each attribute on a scale from 1 (not present) to 9 (extremely intense).
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {intensityAttributes.map(attr => {
                const value = intensityRatings[attr];
                const controlId = `multi-intensity-${currentSampleIndex}-${attr.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
                return <div key={attr} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={controlId}>
                      <AttributeTooltip
                        term={attr}
                        definition={INTENSITY_DEFINITIONS[attr] || CATA_DEFINITIONS[attr] || 'Rate the intensity'}
                      />
                    </Label>
                    <span className="text-sm font-bold text-slate-900">
                      {value ?? 'Not answered'}
                    </span>
                  </div>
                  <input
                    id={controlId}
                    type="range"
                    min={SLIDER_MIN}
                    max={SLIDER_MAX}
                    step="1"
                    value={value ?? SLIDER_MIDPOINT}
                    onChange={(e) => handleIntensityChange(attr, parseInt(e.target.value))}
                    style={optionalSliderFill(value, '#334155')}
                    aria-valuetext={value === undefined ? `${attr}: not answered` : `${attr}: ${value} out of 9`}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-slate-700"
                  />
                  <RangeScaleTicks min={SLIDER_MIN} max={SLIDER_MAX} />
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Not present</span>
                    <span>Moderate</span>
                    <span>Extremely intense</span>
                  </div>
                </div>;
              })}
            </div>
          </CardContent>
        </Card>}

        {/* Hedonic */}
        {configuredSections.includes('hedonic') && <Card>
          <CardHeader>
            <CardTitle>3. Hedonic Scores (Overall Liking)</CardTitle>
            <p className="text-sm text-slate-700">
              Rate how much you like or dislike each aspect on a 9-point scale (1 = Dislike extremely, 9 = Like extremely).
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {HEDONIC_ASPECTS.map(aspect => {
                const value = hedonicScores[aspect];
                const controlId = `multi-hedonic-${currentSampleIndex}-${aspect}`;
                return <div key={aspect} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={controlId} className="capitalize">
                      <AttributeTooltip
                        term={aspect.replace(/([A-Z])/g, ' $1').trim()}
                        definition={HEDONIC_DEFINITIONS[aspect] || 'Rate your liking'}
                      />
                    </Label>
                    <span className="text-sm font-bold text-slate-900">{value === undefined ? 'Not answered' : `${value} / 9`}</span>
                  </div>
                  <input
                    id={controlId}
                    type="range"
                    min={SLIDER_MIN}
                    max={SLIDER_MAX}
                    step="1"
                    value={value ?? SLIDER_MIDPOINT}
                    onChange={(e) => setHedonicScores(prev => ({ ...prev, [aspect]: parseInt(e.target.value) }))}
                    style={optionalSliderFill(value, '#334155')}
                    aria-valuetext={value === undefined ? `${aspect}: not answered` : `${aspect}: ${value} out of 9`}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-slate-700"
                  />
                  <RangeScaleTicks min={SLIDER_MIN} max={SLIDER_MAX} />
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Dislike extremely</span>
                    <span>Neither</span>
                    <span>Like extremely</span>
                  </div>
                </div>;
              })}
            </div>
          </CardContent>
        </Card>}

        {/* Emotions */}
        {configuredSections.includes('emotions') && <Card>
          <CardHeader>
            <CardTitle>4. Emotional Response</CardTitle>
            <p className="text-sm text-slate-700">
              Rate how strongly you feel each emotion when tasting this product. Hover for definitions.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <h4 className="font-bold text-emerald-700 mb-3">Positive Emotions</h4>
                <div className="space-y-3">
                  {SURVEY_EMOTIONS.positive.map(emotion => {
                    const value = emotions[emotion];
                    const controlId = `multi-emotion-positive-${currentSampleIndex}-${emotion.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
                    return <div key={emotion} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={controlId} className="text-sm">
                          <AttributeTooltip
                            term={emotion}
                            definition={EMOTION_DEFINITIONS[emotion] || emotion}
                          />
                        </Label>
                        <span className="text-xs font-bold text-emerald-600">
                          {value ?? '—'}
                        </span>
                      </div>
                      <input
                        id={controlId}
                        type="range"
                        min={SLIDER_MIN}
                        max={SLIDER_MAX}
                        step="1"
                        value={value ?? SLIDER_MIDPOINT}
                        onChange={(e) => handleEmotionChange(emotion, parseInt(e.target.value))}
                        style={optionalSliderFill(value, '#059669')}
                        aria-valuetext={value === undefined ? `${emotion}: not answered` : `${emotion}: ${value} out of 9`}
                        className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />
                      <RangeScaleTicks min={SLIDER_MIN} max={SLIDER_MAX} />
                    </div>;
                  })}
                </div>
              </div>
              <div>
                <h4 className="font-bold text-rose-700 mb-3">Negative Emotions</h4>
                <div className="space-y-3">
                  {SURVEY_EMOTIONS.negative.map(emotion => {
                    const value = emotions[emotion];
                    const controlId = `multi-emotion-negative-${currentSampleIndex}-${emotion.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
                    return <div key={emotion} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={controlId} className="text-sm">
                          <AttributeTooltip
                            term={emotion}
                            definition={EMOTION_DEFINITIONS[emotion] || emotion}
                          />
                        </Label>
                        <span className="text-xs font-bold text-rose-600">
                          {value ?? '—'}
                        </span>
                      </div>
                      <input
                        id={controlId}
                        type="range"
                        min={SLIDER_MIN}
                        max={SLIDER_MAX}
                        step="1"
                        value={value ?? SLIDER_MIDPOINT}
                        onChange={(e) => handleEmotionChange(emotion, parseInt(e.target.value))}
                        style={optionalSliderFill(value, '#e11d48')}
                        aria-valuetext={value === undefined ? `${emotion}: not answered` : `${emotion}: ${value} out of 9`}
                        className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-rose-600"
                      />
                      <RangeScaleTicks min={SLIDER_MIN} max={SLIDER_MAX} />
                    </div>;
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>}

        {configuredSections.includes('comments') && <Card>
          <CardHeader>
            <CardTitle>Additional comments</CardTitle>
            <p className="text-sm text-slate-700">Share anything important that the structured questions did not capture for this sample.</p>
          </CardHeader>
          <CardContent>
            <textarea
              className="w-full resize-none rounded-lg border border-slate-200 p-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
              rows={4}
              maxLength={2000}
              value={comments}
              onChange={event => setComments(event.target.value)}
              placeholder="Describe anything else you noticed…"
            />
          </CardContent>
        </Card>}

        <div className="sticky bottom-0 z-20 -mx-3 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:mx-0 sm:rounded-t-lg sm:border">
          <Button 
            onClick={handleContinueFromSample}
            className="w-full bg-slate-900 hover:bg-slate-800 text-base py-6 sm:text-lg"
          >
            {currentSampleIndex < samples.length - 1 ? 'Continue to Next Sample' : 'Continue to Discrimination Test'}
            <ChevronRight className="size-5 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  // Palate cleanse interstitial
  if (currentStep === 'cleanse') {
    const nextSampleCode = samples[currentSampleIndex + 1]?.code ?? '';
    const cleanseBadgeClass = cleanseCountdown > 0
      ? 'border-slate-200 text-slate-700 bg-slate-50'
      : 'border-emerald-300 text-emerald-800 bg-emerald-50';
    return (
      <div className="max-w-4xl mx-auto px-3 sm:px-0">
        <Card className="border border-slate-200 bg-white">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl text-slate-900">Palate Cleanse Required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-center">
            <p className="text-slate-700 text-base">
              Take a sip of water and eat a plain cracker. Wait {PALATE_CLEANSE_SECONDS} seconds before continuing.
            </p>
            <div className="flex items-center justify-center">
              <div className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold border-4 ${cleanseBadgeClass}`}>
                {cleanseCountdown > 0 ? cleanseCountdown : <CheckCircle2 className="size-10" />}
              </div>
            </div>
            <Button
              onClick={handleContinueFromCleanse}
              disabled={cleanseCountdown > 0}
              className="w-full bg-slate-900 hover:bg-slate-800 text-lg py-6 disabled:opacity-50"
            >
              {cleanseCountdown > 0
                ? `Wait ${cleanseCountdown}s…`
                : `Continue to Sample ${nextSampleCode}`}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Discrimination question screen
  if (currentStep === 'discrimination') {
    return (
      <div className="max-w-4xl mx-auto space-y-4 px-3 pb-24 sm:px-0 sm:space-y-6">
        <Card className="border border-slate-200 bg-white">
          <CardContent className="pt-4">
            <Badge variant="outline" className="border-slate-200 text-slate-700 text-lg px-4 py-2">
              Step 4/4
            </Badge>
          </CardContent>
        </Card>

        <Card className="border border-slate-200">
          <CardHeader className="bg-white">
            <CardTitle className="text-2xl">Triangle Test Choice</CardTitle>
            <p className="text-slate-700 mt-2">
              You have just tasted three coded servings. Two are the same and one is different.
            </p>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <Label className="text-lg font-bold">Which coded serving is different?</Label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
                {samples.map(sample => (
                  <button
                    key={sample.code}
                    onClick={() => setDifferentSample(sample.code)}
                    className={`rounded-lg border-2 p-5 transition-all sm:p-6 ${
                      differentSample === sample.code
                        ? 'border-slate-900 bg-slate-50'
                        : 'border-slate-200 bg-white hover:border-slate-500'
                    }`}
                  >
                    <div className="text-3xl font-bold text-slate-900 mb-2">{sample.code}</div>
                    {differentSample === sample.code && (
                      <CheckCircle2 className="size-6 text-slate-700 mx-auto" />
                    )}
                  </button>
                ))}
              </div>
              
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mt-4">
                <p className="text-sm text-slate-700">
                  <strong>Note:</strong> Consider differences in taste, texture, aroma, and appearance when making your selection.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {discriminationError && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{discriminationError}</AlertDescription>
          </Alert>
        )}

        <div className="sticky bottom-0 z-20 -mx-3 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:mx-0 sm:rounded-t-lg sm:border">
          <Button
            onClick={handleContinueFromDiscrimination}
            disabled={!differentSample}
            className="w-full bg-slate-900 hover:bg-slate-800 text-base py-6 disabled:opacity-50 sm:text-lg"
          >
            Review & Confirm
            <ChevronRight className="size-5 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  // Confirmation screen
  if (currentStep === 'confirmation') {
    return (
      <div className="max-w-6xl mx-auto space-y-4 px-3 pb-24 sm:px-0 sm:space-y-6">
        <Card className="border border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-2xl">Review Your Responses</CardTitle>
            <p className="text-slate-700">Please review all information before final submission. Your responses will be securely recorded and available to study administrators.</p>
          </CardHeader>
        </Card>

        {/* Sample responses */}
        {sampleResponses.map((response) => (
          <Card key={response.sampleCode} className="border border-slate-200">
            <CardHeader className="bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-lg flex-shrink-0">
                  {response.sampleCode}
                </div>
                <CardTitle>Sample Code: {response.sampleCode}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {configuredSections.includes('cata') && <div>
                  <h4 className="font-bold text-slate-900 mb-2">CATA Attributes Selected:</h4>
                  <div className="flex flex-wrap gap-2">
                    {response.cataAttributes.map(attr => (
                      <Badge key={attr} variant="outline" className="border-slate-200 text-slate-700">{attr}</Badge>
                    ))}
                  </div>
                </div>}
                {configuredSections.includes('hedonic') && <div>
                  <h4 className="font-bold text-slate-900 mb-2">Hedonic Scores:</h4>
                  <div className="space-y-1 text-sm">
                    {Object.entries(response.hedonicScores).map(([aspect, value]) => (
                      <div key={aspect} className="flex justify-between">
                        <span className="capitalize text-slate-700">{aspect}:</span>
                        <span className="font-bold text-slate-900">{value}/9</span>
                      </div>
                    ))}
                  </div>
                </div>}
                {configuredSections.includes('comments') && response.comments && <div className="md:col-span-2">
                  <h4 className="mb-2 font-bold text-slate-900">Additional comments:</h4>
                  <p className="whitespace-pre-wrap text-sm text-slate-700">{response.comments}</p>
                </div>}
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Triangle test choice */}
        <Card className="border border-slate-200">
          <CardHeader className="bg-white">
            <CardTitle>Triangle Test Choice</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3">
              <div>
                <span className="font-bold text-slate-900">Different coded serving: </span>
                <Badge variant="outline" className="border-slate-200 text-lg text-slate-700">{differentSample}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="sticky bottom-0 z-20 -mx-3 space-y-3 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:mx-0 sm:rounded-t-lg sm:border">
            <Alert className="border-slate-200 bg-white">
              <AlertCircle className="size-4 text-slate-500" />
              <AlertDescription className="text-slate-700">
                <strong>Important:</strong> Once submitted, you cannot edit your responses. Please review all information carefully.
              </AlertDescription>
            </Alert>
            {submitError && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>
                  <strong>Submission failed:</strong> {submitError}
                </AlertDescription>
              </Alert>
            )}
            <Button
              onClick={handleFinalSubmit}
              disabled={isSubmitting}
              className="w-full bg-slate-900 hover:bg-slate-800 text-base py-6 disabled:opacity-70 sm:text-lg"
            >
              <CheckCircle2 className="size-5 mr-2" />
              {isSubmitting ? 'Submitting…' : 'Submit Final Questionnaire'}
            </Button>
        </div>
      </div>
    );
  }

  // Submitted screen
  if (currentStep === 'submitted') {
    return (
      <PanelistSubmissionSuccess
        title="Triangle test submitted"
        message={<>Thank you for completing the triangle test for <strong>{displayName}</strong>.</>}
        warning={completionWarning}
        onBack={() => navigate('/panelist')}
      />
    );
  }

  return null;
}

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { useAuth } from '../contexts/auth-context';
import { DEFAULT_CATA_ATTRIBUTES, INTENSITY_ATTRIBUTES, ESSENSE25_EMOTIONS, type Product } from '../data/mock-users';
import { fetchProduct, fetchUserResponse, upsertResponse } from '../lib/database';
import { CATA_DEFINITIONS, INTENSITY_DEFINITIONS, HEDONIC_DEFINITIONS, EMOTION_DEFINITIONS } from '../data/attribute-definitions';
import { AlertCircle, CheckCircle2, ChevronRight, Download } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { AttributeTooltip } from './attribute-tooltip';

type Step = 'intro' | 'sample' | 'discrimination' | 'ranking' | 'confirmation' | 'submitted';

interface SampleResponse {
  sampleId: string;
  sampleCode: string;
  cataAttributes: string[];
  intensityRatings: Record<string, number>;
  hedonicScores: {
    overall: number;
    appearance: number;
    aroma: number;
    flavor: number;
    texture: number;
  };
  emotions: Record<string, number>;
}

export function MultiSampleQuestionnaire() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [product, setProduct] = useState<Product | null>(null);

  useEffect(() => {
    if (!productId) return;
    fetchProduct(productId).then(setProduct).catch(console.error);
  }, [productId]);

  // Multi-sample flow state
  const [currentStep, setCurrentStep] = useState<Step>('intro');
  const [currentSampleIndex, setCurrentSampleIndex] = useState(0);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);

  // Get samples from product data
  const samples = product?.samples || [
    { id: '1', code: '341', label: 'Sample 1' },
    { id: '2', code: '872', label: 'Sample 2' },
    { id: '3', code: '529', label: 'Sample 3' }
  ];
  
  // Responses for each sample
  const [sampleResponses, setSampleResponses] = useState<SampleResponse[]>([]);
  
  // Current sample form state
  const [selectedCata, setSelectedCata] = useState<string[]>([]);
  const [intensityRatings, setIntensityRatings] = useState<Record<string, number>>({});
  const [hedonicScores, setHedonicScores] = useState({
    overall: 5,
    appearance: 5,
    aroma: 5,
    flavor: 5,
    texture: 5
  });
  const [emotions, setEmotions] = useState<Record<string, number>>({});
  
  // Discrimination question state
  const [differentSample, setDifferentSample] = useState<string>('');
  
  // Ranking state
  const [ranking, setRanking] = useState<string[]>([]);
  
  const cataAttributes = product?.customAttributes || DEFAULT_CATA_ATTRIBUTES;

  useEffect(() => {
    if (!user?.id || !productId) return;
    fetchUserResponse(user.id, productId).then(existing => {
      if (existing) setAlreadyCompleted(true);
    });
  }, [productId, user?.id]);

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
    const response: SampleResponse = {
      sampleId: samples[currentSampleIndex].id,
      sampleCode: samples[currentSampleIndex].code,
      cataAttributes: selectedCata,
      intensityRatings,
      hedonicScores,
      emotions
    };
    
    setSampleResponses(prev => [...prev, response]);
    
    // Reset form for next sample
    setSelectedCata([]);
    setIntensityRatings({});
    setHedonicScores({
      overall: 5,
      appearance: 5,
      aroma: 5,
      flavor: 5,
      texture: 5
    });
    setEmotions({});
  };

  const handleContinueFromSample = () => {
    saveSampleResponse();
    
    if (currentSampleIndex < samples.length - 1) {
      setCurrentSampleIndex(prev => prev + 1);
    } else {
      setCurrentStep('discrimination');
    }
  };

  const handleContinueFromDiscrimination = () => {
    if (!differentSample) {
      alert('Please select which sample is different');
      return;
    }
    setCurrentStep('ranking');
  };

  const handleRanking = (sampleCode: string, position: number) => {
    const newRanking = [...ranking];
    // Remove sample from any existing position
    const existingIndex = newRanking.indexOf(sampleCode);
    if (existingIndex !== -1) {
      newRanking.splice(existingIndex, 1);
    }
    // Add to new position
    newRanking.splice(position, 0, sampleCode);
    setRanking(newRanking);
  };

  const handleContinueFromRanking = () => {
    if (ranking.length !== 3) {
      alert('Please rank all three samples');
      return;
    }
    setCurrentStep('confirmation');
  };

  const handleFinalSubmit = async () => {
    if (!user?.id || !productId) return;
    try {
      await upsertResponse({
        userId: user.id,
        productId,
        cataAttributes: sampleResponses.flatMap(s => s.cataAttributes),
        intensityRatings: sampleResponses[0]?.intensityRatings ?? {},
        hedonicScores: sampleResponses[0]?.hedonicScores ?? { overall: 5, appearance: 5, aroma: 5, flavor: 5, texture: 5 },
        emotionalProfile: sampleResponses[0]?.emotions ?? {},
      });
      setCurrentStep('submitted');
      setTimeout(() => navigate('/panelist'), 3000);
    } catch (err) {
      console.error('Failed to submit multi-sample response:', err);
    }
  };

  const exportSessionCSV = () => {
    const headers = ['SampleCode', 'Attribute', 'Value', 'Type'];
    const rows: string[] = [headers.join(',')];
    
    sampleResponses.forEach(response => {
      // CATA attributes
      response.cataAttributes.forEach(attr => {
        rows.push(`${response.sampleCode},${attr},1,CATA`);
      });
      
      // Intensity ratings
      Object.entries(response.intensityRatings).forEach(([attr, value]) => {
        rows.push(`${response.sampleCode},${attr},${value},Intensity`);
      });
      
      // Hedonic scores
      Object.entries(response.hedonicScores).forEach(([attr, value]) => {
        rows.push(`${response.sampleCode},Hedonic_${attr},${value},Hedonic`);
      });
      
      // Emotions
      Object.entries(response.emotions).forEach(([emotion, value]) => {
        rows.push(`${response.sampleCode},${emotion},${value},Emotion`);
      });
    });
    
    // Add discrimination and ranking
    rows.push(`All,Discrimination,${differentSample},Meta`);
    rows.push(`All,Ranking,"${ranking.join(' > ')}",Meta`);
    
    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-${user?.panelistId}-${productId}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

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
              You have already completed the multi-sample evaluation for <strong>{product.name}</strong>.
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
        <Card className="border-2 border-blue-300">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50">
            <CardTitle className="text-2xl">Multi-Sample Sequential Evaluation</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div>
              <h3 className="font-bold text-slate-900 mb-2">Instructions:</h3>
              <ol className="list-decimal list-inside space-y-2 text-slate-700">
                <li>You will evaluate <strong>{samples.length} samples</strong> sequentially</li>
                <li>Each sample is identified only by a unique <strong>3-digit code</strong></li>
                <li>Complete the questionnaire for each sample before continuing</li>
                <li>After all samples, you will identify which sample is <strong>different</strong></li>
                <li>Finally, you will <strong>rank</strong> the samples from best to worst</li>
                <li>Review all responses before final submission</li>
              </ol>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
              <p className="text-sm text-blue-900 font-medium mb-2">🔒 Blind Evaluation Protocol</p>
              <p className="text-sm text-slate-700">
                Sample identities are concealed to ensure unbiased evaluation. You will only see 3-digit codes during this test. Do not discuss or attempt to identify samples.
              </p>
            </div>
            
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <h4 className="font-bold text-purple-900 mb-2">Session Information:</h4>
              <div className="text-sm space-y-1 text-slate-700">
                <p><strong>Study:</strong> {product.name}</p>
                <p><strong>Category:</strong> {product.category}</p>
                <p><strong>Panelist ID:</strong> {user?.panelistId}</p>
                <p><strong>Samples:</strong> {samples.length}</p>
                <p><strong>Estimated time:</strong> {15 + (samples.length - 3) * 5}-{20 + (samples.length - 3) * 5} minutes</p>
              </div>
            </div>
            
            <Button 
              onClick={() => setCurrentStep('sample')} 
              className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-6"
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
    const progress = Math.round(((currentSampleIndex + 1) / 5) * 100); // 5 total steps
    
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Progress indicator */}
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-300">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-bold text-slate-900">Evaluating Sample: <span className="text-purple-600">{currentSample.code}</span></h3>
                <p className="text-sm text-slate-600">{currentSampleIndex + 1} of {samples.length} samples completed</p>
              </div>
              <div className="w-16 h-16 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-xl flex-shrink-0">
                {currentSample.code}
              </div>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className="bg-purple-600 h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </CardContent>
        </Card>

        {/* CATA */}
        <Card>
          <CardHeader>
            <CardTitle>1. Flavor & Aroma Attributes (CATA)</CardTitle>
            <p className="text-sm text-slate-600">
              Select ALL attributes that you perceive in Sample {currentSample.code}. Hover over any attribute for its definition.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
                      definition={CATA_DEFINITIONS[attr] || 'Sensory attribute'}
                    />
                  </Label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Intensity */}
        <Card>
          <CardHeader>
            <CardTitle>2. Intensity Ratings</CardTitle>
            <p className="text-sm text-slate-600">
              Rate the intensity of each attribute. Hover over the attribute name for guidance.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {INTENSITY_ATTRIBUTES.map(attr => (
                <div key={attr} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>
                      <AttributeTooltip
                        term={attr}
                        definition={INTENSITY_DEFINITIONS[attr] || CATA_DEFINITIONS[attr] || 'Rate the intensity'}
                      />
                    </Label>
                    <span className="text-sm font-bold text-purple-600">
                      {intensityRatings[attr] || 0}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="1"
                    value={intensityRatings[attr] || 0}
                    onChange={(e) => handleIntensityChange(attr, parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                  />
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Not present (0)</span>
                    <span>Extremely intense (10)</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Hedonic */}
        <Card>
          <CardHeader>
            <CardTitle>3. Hedonic Scores (Overall Liking)</CardTitle>
            <p className="text-sm text-slate-600">
              Rate how much you like or dislike each aspect. Hover for more information.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(hedonicScores).map(([aspect, value]) => (
                <div key={aspect} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="capitalize">
                      <AttributeTooltip
                        term={aspect.replace(/([A-Z])/g, ' $1').trim()}
                        definition={HEDONIC_DEFINITIONS[aspect] || 'Rate your liking'}
                      />
                    </Label>
                    <span className="text-sm font-bold text-blue-600">{value}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="9"
                    step="0.5"
                    value={value}
                    onChange={(e) => setHedonicScores(prev => ({ ...prev, [aspect]: parseFloat(e.target.value) }))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Dislike extremely (1)</span>
                    <span>Neither (5)</span>
                    <span>Like extremely (9)</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Emotions */}
        <Card>
          <CardHeader>
            <CardTitle>4. Emotional Response (EsSense25)</CardTitle>
            <p className="text-sm text-slate-600">
              Rate how strongly you feel each emotion when tasting this product. Hover for definitions.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="font-bold text-emerald-700 mb-3">Positive Emotions</h4>
                <div className="space-y-3">
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
                          {emotions[emotion] || 0}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="5"
                        step="1"
                        value={emotions[emotion] || 0}
                        onChange={(e) => handleEmotionChange(emotion, parseInt(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-bold text-rose-700 mb-3">Negative Emotions</h4>
                <div className="space-y-3">
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
                          {emotions[emotion] || 0}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="5"
                        step="1"
                        value={emotions[emotion] || 0}
                        onChange={(e) => handleEmotionChange(emotion, parseInt(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Continue Button */}
        <Card className="bg-gradient-to-r from-emerald-50 to-blue-50 border-2 border-emerald-300">
          <CardContent className="pt-6">
            <Button 
              onClick={handleContinueFromSample}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-lg py-6"
            >
              {currentSampleIndex < samples.length - 1 ? 'Continue to Next Sample' : 'Continue to Discrimination Test'}
              <ChevronRight className="size-5 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Discrimination question screen
  if (currentStep === 'discrimination') {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300">
          <CardContent className="pt-4">
            <Badge className="bg-amber-600 text-white text-lg px-4 py-2">
              Step 4/5
            </Badge>
          </CardContent>
        </Card>

        <Card className="border-2 border-amber-400">
          <CardHeader className="bg-amber-50">
            <CardTitle className="text-2xl">Discrimination Task</CardTitle>
            <p className="text-slate-600 mt-2">
              You have just tasted three samples. One of them is different from the other two.
            </p>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <Label className="text-lg font-bold">Which sample is different?</Label>
              <div className="grid grid-cols-3 gap-4">
                {samples.map(sample => (
                  <button
                    key={sample.code}
                    onClick={() => setDifferentSample(sample.code)}
                    className={`p-6 rounded-lg border-2 transition-all ${
                      differentSample === sample.code
                        ? 'border-amber-600 bg-amber-100 shadow-lg'
                        : 'border-slate-300 bg-white hover:border-amber-400'
                    }`}
                  >
                    <div className="text-3xl font-bold text-slate-900 mb-2">{sample.code}</div>
                    {differentSample === sample.code && (
                      <CheckCircle2 className="size-6 text-amber-600 mx-auto" />
                    )}
                  </button>
                ))}
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mt-4">
                <p className="text-sm text-slate-700">
                  <strong>Note:</strong> Consider differences in taste, texture, aroma, and appearance when making your selection.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-emerald-50 to-blue-50 border-2 border-emerald-300">
          <CardContent className="pt-6">
            <Button 
              onClick={handleContinueFromDiscrimination}
              disabled={!differentSample}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-lg py-6 disabled:opacity-50"
            >
              Continue to Ranking
              <ChevronRight className="size-5 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Ranking screen
  if (currentStep === 'ranking') {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300">
          <CardContent className="pt-4">
            <Badge className="bg-purple-600 text-white text-lg px-4 py-2">
              Step 5/5
            </Badge>
          </CardContent>
        </Card>

        <Card className="border-2 border-purple-400">
          <CardHeader className="bg-purple-50">
            <CardTitle className="text-2xl">Preference Ranking</CardTitle>
            <p className="text-slate-600 mt-2">
              Rank the three samples from <strong>BEST</strong> to <strong>WORST</strong> based on overall preference
            </p>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              {[0, 1, 2].map(position => (
                <div key={position} className="space-y-2">
                  <Label className="text-lg font-bold">
                    {position === 0 ? '🥇 Best (Rank 1)' : position === 1 ? '🥈 Middle (Rank 2)' : '🥉 Worst (Rank 3)'}
                  </Label>
                  <div className="grid grid-cols-3 gap-3">
                    {samples.map(sample => {
                      const isSelected = ranking[position] === sample.code;
                      const isUsed = ranking.includes(sample.code) && !isSelected;
                      
                      return (
                        <button
                          key={sample.code}
                          onClick={() => !isUsed && handleRanking(sample.code, position)}
                          disabled={isUsed}
                          className={`p-4 rounded-lg border-2 transition-all ${
                            isSelected
                              ? 'border-purple-600 bg-purple-100 shadow-lg'
                              : isUsed
                              ? 'border-slate-200 bg-slate-100 opacity-50 cursor-not-allowed'
                              : 'border-slate-300 bg-white hover:border-purple-400'
                          }`}
                        >
                          <div className="text-2xl font-bold text-slate-900">{sample.code}</div>
                          {isSelected && <CheckCircle2 className="size-5 text-purple-600 mx-auto mt-2" />}
                          {isUsed && <div className="text-xs text-slate-500 mt-1">Already ranked</div>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              
              {ranking.length === 3 && (
                <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                  <p className="text-sm font-bold text-emerald-900">
                    ✓ Your ranking: {ranking[0]} (Best) → {ranking[1]} → {ranking[2]} (Worst)
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-emerald-50 to-blue-50 border-2 border-emerald-300">
          <CardContent className="pt-6">
            <Button 
              onClick={handleContinueFromRanking}
              disabled={ranking.length !== 3}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-lg py-6 disabled:opacity-50"
            >
              Review & Confirm
              <ChevronRight className="size-5 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Confirmation screen
  if (currentStep === 'confirmation') {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-300">
          <CardHeader>
            <CardTitle className="text-2xl">Review Your Responses</CardTitle>
            <p className="text-slate-600">Please review all information before final submission. Your responses will be securely recorded and available to study administrators.</p>
          </CardHeader>
        </Card>

        {/* Sample responses */}
        {sampleResponses.map((response, idx) => (
          <Card key={response.sampleCode} className="border-2 border-slate-300">
            <CardHeader className="bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-lg flex-shrink-0">
                  {response.sampleCode}
                </div>
                <CardTitle>Sample Code: {response.sampleCode}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="font-bold text-slate-900 mb-2">CATA Attributes Selected:</h4>
                  <div className="flex flex-wrap gap-2">
                    {response.cataAttributes.map(attr => (
                      <Badge key={attr} className="bg-blue-600">{attr}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 mb-2">Hedonic Scores:</h4>
                  <div className="space-y-1 text-sm">
                    {Object.entries(response.hedonicScores).map(([aspect, value]) => (
                      <div key={aspect} className="flex justify-between">
                        <span className="capitalize text-slate-700">{aspect}:</span>
                        <span className="font-bold text-blue-600">{value}/9</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Discrimination & Ranking */}
        <Card className="border-2 border-amber-300">
          <CardHeader className="bg-amber-50">
            <CardTitle>Discrimination & Ranking</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3">
              <div>
                <span className="font-bold text-slate-900">Different Sample: </span>
                <Badge className="bg-amber-600 text-lg">{differentSample}</Badge>
              </div>
              <div>
                <span className="font-bold text-slate-900">Preference Ranking: </span>
                <span className="text-lg text-slate-700">
                  {ranking[0]} (Best) → {ranking[1]} → {ranking[2]} (Worst)
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <Card className="bg-gradient-to-r from-emerald-50 to-blue-50 border-2 border-emerald-300">
          <CardContent className="pt-6 space-y-4">
            <Alert className="border-blue-300 bg-blue-50">
              <AlertCircle className="size-4 text-blue-600" />
              <AlertDescription className="text-blue-900">
                <strong>Important:</strong> Once submitted, you cannot edit your responses. Please review all information carefully.
              </AlertDescription>
            </Alert>
            <Button 
              onClick={handleFinalSubmit}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-lg py-6"
            >
              <CheckCircle2 className="size-5 mr-2" />
              Submit Final Questionnaire
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Submitted screen
  if (currentStep === 'submitted') {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="border-2 border-emerald-300 bg-emerald-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-6 text-emerald-600" />
              Multi-Sample Evaluation Submitted Successfully!
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-700 mb-2">
              Thank you for completing the 3-sample sequential evaluation for <strong>{product.name}</strong>.
            </p>
            <p className="text-sm text-slate-600">
              Redirecting to dashboard...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}

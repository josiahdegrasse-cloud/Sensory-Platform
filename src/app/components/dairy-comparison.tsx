import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ENHANCED_SENSORY_DATA } from '../data/enhanced-sensory';
import { SAMPLES } from '../data/samples';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { TrendingUp, TrendingDown, AlertCircle, Lightbulb, ArrowRight } from 'lucide-react';

export function DairyComparison() {
  const [selectedPBCA, setSelectedPBCA] = useState('S3');
  const [selectedDairy, setSelectedDairy] = useState('D1');

  const pbcaSample = ENHANCED_SENSORY_DATA.find(s => s.sampleId === selectedPBCA);
  const dairySample = ENHANCED_SENSORY_DATA.find(s => s.sampleId === selectedDairy);

  const pbcaSamples = SAMPLES.filter(s => s.type === 'pbca');
  const dairySamples = SAMPLES.filter(s => s.type === 'dairy');

  // Taste profile comparison
  const tasteComparisonData = pbcaSample && dairySample ? [
    { attribute: 'Sourness', pbca: pbcaSample.taste.sourness, dairy: dairySample.taste.sourness },
    { attribute: 'Bitterness', pbca: pbcaSample.taste.bitterness, dairy: dairySample.taste.bitterness },
    { attribute: 'Astringency', pbca: pbcaSample.taste.astringency, dairy: dairySample.taste.astringency },
    { attribute: 'Umami', pbca: pbcaSample.taste.umami, dairy: dairySample.taste.umami },
    { attribute: 'Saltiness', pbca: pbcaSample.taste.saltiness, dairy: dairySample.taste.saltiness },
    { attribute: 'Sweetness', pbca: pbcaSample.taste.sweetness, dairy: dairySample.taste.sweetness },
    { attribute: 'Richness', pbca: pbcaSample.taste.richness, dairy: dairySample.taste.richness },
  ] : [];

  // Composition comparison
  const compositionData = pbcaSample && dairySample ? [
    { component: 'Salt', pbca: pbcaSample.composition.salt, dairy: dairySample.composition.salt },
    { component: 'Fat', pbca: pbcaSample.composition.fat, dairy: dairySample.composition.fat },
    { component: 'Protein', pbca: pbcaSample.composition.protein, dairy: dairySample.composition.protein },
  ] : [];

  // Hedonic comparison
  const hedonicData = pbcaSample && dairySample ? [
    { aspect: 'Overall', pbca: pbcaSample.hedonic.overall, dairy: dairySample.hedonic.overall },
    { aspect: 'Appearance', pbca: pbcaSample.hedonic.appearance, dairy: dairySample.hedonic.appearance },
    { aspect: 'Aroma', pbca: pbcaSample.hedonic.aroma, dairy: dairySample.hedonic.aroma },
    { aspect: 'Flavor', pbca: pbcaSample.hedonic.flavor, dairy: dairySample.hedonic.flavor },
    { aspect: 'Texture', pbca: pbcaSample.hedonic.texture, dairy: dairySample.hedonic.texture },
  ] : [];

  // Calculate gaps and generate suggestions
  const generateSuggestions = () => {
    if (!pbcaSample || !dairySample) return [];

    const suggestions = [];

    // Taste gaps
    const saltGap = dairySample.taste.saltiness - pbcaSample.taste.saltiness;
    if (Math.abs(saltGap) > 1.5) {
      suggestions.push({
        type: saltGap > 0 ? 'increase' : 'decrease',
        attribute: 'Saltiness',
        gap: Math.abs(saltGap).toFixed(1),
        action: saltGap > 0 
          ? `Increase salt content by ~${((Math.abs(saltGap) / dairySample.taste.saltiness) * 100).toFixed(0)}%`
          : `Reduce salt content by ~${((Math.abs(saltGap) / pbcaSample.taste.saltiness) * 100).toFixed(0)}%`,
        impact: 'high'
      });
    }

    const umamiGap = dairySample.taste.umami - pbcaSample.taste.umami;
    if (Math.abs(umamiGap) > 1.0) {
      suggestions.push({
        type: umamiGap > 0 ? 'increase' : 'decrease',
        attribute: 'Umami',
        gap: Math.abs(umamiGap).toFixed(1),
        action: umamiGap > 0 
          ? 'Add umami enhancers: nutritional yeast, miso, or glutamate-rich ingredients'
          : 'Reduce fermentation time or umami-rich ingredients',
        impact: 'high'
      });
    }

    const sweetnessGap = dairySample.taste.sweetness - pbcaSample.taste.sweetness;
    if (Math.abs(sweetnessGap) > 1.0) {
      suggestions.push({
        type: sweetnessGap > 0 ? 'increase' : 'decrease',
        attribute: 'Sweetness',
        gap: Math.abs(sweetnessGap).toFixed(1),
        action: sweetnessGap > 0 
          ? 'Increase lactose-equivalent sugars or natural sweeteners'
          : 'Reduce sugar content in base formulation',
        impact: 'medium'
      });
    }

    // Composition gaps
    const fatGap = dairySample.composition.fat - pbcaSample.composition.fat;
    if (Math.abs(fatGap) > 3) {
      suggestions.push({
        type: fatGap > 0 ? 'increase' : 'decrease',
        attribute: 'Fat Content',
        gap: `${Math.abs(fatGap).toFixed(1)}%`,
        action: fatGap > 0 
          ? `Increase coconut oil or plant-based fats by ${Math.abs(fatGap).toFixed(1)}% to match dairy richness`
          : `Reduce fat content by ${Math.abs(fatGap).toFixed(1)}%`,
        impact: 'high'
      });
    }

    const proteinGap = dairySample.composition.protein - pbcaSample.composition.protein;
    if (Math.abs(proteinGap) > 2) {
      suggestions.push({
        type: proteinGap > 0 ? 'increase' : 'decrease',
        attribute: 'Protein',
        gap: `${Math.abs(proteinGap).toFixed(1)}%`,
        action: proteinGap > 0 
          ? 'Add pea protein isolate, hemp protein, or other plant proteins'
          : 'Reduce protein concentration',
        impact: 'medium'
      });
    }

    // Hedonic gaps
    const hedonicGap = dairySample.hedonic.overall - pbcaSample.hedonic.overall;
    if (Math.abs(hedonicGap) > 1.0) {
      suggestions.push({
        type: 'hedonic',
        attribute: 'Overall Liking',
        gap: Math.abs(hedonicGap).toFixed(1),
        action: hedonicGap > 0 
          ? 'Focus on improving flavor profile and texture to match dairy benchmark'
          : 'Current formulation exceeds dairy benchmark',
        impact: hedonicGap > 0 ? 'critical' : 'positive'
      });
    }

    // Off-notes detection
    const pbcaOffNotes = pbcaSample.gcmsOlfactometry.filter(c => 
      !c.isBlankArtefact && c.odourIntensity >= 3 && (
        c.odour.toLowerCase().includes('rancid') ||
        c.odour.toLowerCase().includes('cardboard') ||
        c.odour.toLowerCase().includes('coconut') ||
        c.odour.toLowerCase().includes('beany')
      )
    );

    if (pbcaOffNotes.length > 0) {
      pbcaOffNotes.forEach(note => {
        suggestions.push({
          type: 'decrease',
          attribute: `Off-note: ${note.odour}`,
          gap: note.odourIntensity.toFixed(1),
          action: `Reduce ${note.compound} concentration through processing modifications or masking agents`,
          impact: 'critical'
        });
      });
    }

    return suggestions;
  };

  const suggestions = generateSuggestions();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dairy Benchmark Comparison</h1>
        <p className="text-slate-600 mt-2">Compare plant-based cheese samples to dairy controls and receive formulation suggestions</p>
      </div>

      {/* Sample Selectors */}
      <div className="grid grid-cols-2 gap-6">
        <Card className="border-2 border-blue-300">
          <CardHeader>
            <CardTitle className="text-lg">Plant-Based Cheese Sample</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pbcaSamples.map(sample => (
                <button
                  key={sample.id}
                  onClick={() => setSelectedPBCA(sample.id)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                    selectedPBCA === sample.id
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-slate-200 hover:border-blue-300'
                  }`}
                >
                  <div className="font-bold text-slate-900">{sample.name}</div>
                  <div className="text-xs text-slate-500">{sample.category}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-emerald-300">
          <CardHeader>
            <CardTitle className="text-lg">Dairy Control Sample</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {dairySamples.map(sample => (
                <button
                  key={sample.id}
                  onClick={() => setSelectedDairy(sample.id)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                    selectedDairy === sample.id
                      ? 'border-emerald-600 bg-emerald-50'
                      : 'border-slate-200 hover:border-emerald-300'
                  }`}
                >
                  <div className="font-bold text-slate-900">{sample.name}</div>
                  <div className="text-xs text-slate-500">{sample.category}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Taste Profile Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Taste Profile Comparison (E-Tongue)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={tasteComparisonData.map(d => ({
              attribute: d.attribute,
              'Plant-Based': (d.pbca / 10) * 100,
              'Dairy': (d.dairy / 10) * 100
            }))}>
              <PolarGrid />
              <PolarAngleAxis dataKey="attribute" tick={{ fontSize: 12 }} />
              <PolarRadiusAxis domain={[0, 100]} />
              <Radar name="Plant-Based" dataKey="Plant-Based" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
              <Radar name="Dairy Control" dataKey="Dairy" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Composition Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Chemical Composition Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={compositionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="component" />
              <YAxis label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="pbca" fill="#3b82f6" name="Plant-Based" />
              <Bar dataKey="dairy" fill="#10b981" name="Dairy Control" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Hedonic Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Consumer Liking Comparison (9-Point Hedonic Scale)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={hedonicData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="aspect" />
              <YAxis domain={[0, 9]} label={{ value: 'Hedonic Score', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="pbca" fill="#3b82f6" name="Plant-Based" />
              <Bar dataKey="dairy" fill="#10b981" name="Dairy Control" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Formulation Suggestions */}
      <Card className="border-2 border-purple-300 bg-gradient-to-r from-purple-50 to-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="size-6 text-purple-600" />
            Formulation Suggestions
          </CardTitle>
          <p className="text-sm text-slate-600">AI-generated recommendations to close gaps with dairy benchmark</p>
        </CardHeader>
        <CardContent>
          {suggestions.length > 0 ? (
            <div className="space-y-4">
              {suggestions.map((suggestion, index) => (
                <Card key={index} className={`border-2 ${
                  suggestion.impact === 'critical' ? 'border-rose-300 bg-rose-50' :
                  suggestion.impact === 'high' ? 'border-amber-300 bg-amber-50' :
                  suggestion.impact === 'positive' ? 'border-emerald-300 bg-emerald-50' :
                  'border-blue-300 bg-blue-50'
                }`}>
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        {suggestion.type === 'increase' ? (
                          <TrendingUp className={`size-6 ${
                            suggestion.impact === 'critical' ? 'text-rose-600' :
                            suggestion.impact === 'high' ? 'text-amber-600' :
                            'text-blue-600'
                          }`} />
                        ) : suggestion.type === 'decrease' ? (
                          <TrendingDown className={`size-6 ${
                            suggestion.impact === 'critical' ? 'text-rose-600' :
                            'text-blue-600'
                          }`} />
                        ) : (
                          <AlertCircle className="size-6 text-purple-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-bold text-slate-900">{suggestion.attribute}</span>
                          <Badge className={
                            suggestion.impact === 'critical' ? 'bg-rose-600' :
                            suggestion.impact === 'high' ? 'bg-amber-600' :
                            suggestion.impact === 'positive' ? 'bg-emerald-600' :
                            'bg-blue-600'
                          }>
                            {suggestion.impact === 'positive' ? 'Excellent' : suggestion.impact}
                          </Badge>
                        </div>
                        <div className="text-sm text-slate-700 mb-2">
                          <strong>Gap:</strong> {suggestion.gap} {suggestion.attribute.includes('%') ? '' : 'points'}
                        </div>
                        <div className="flex items-start gap-2 bg-white p-3 rounded-lg border border-slate-200">
                          <ArrowRight className="size-5 text-purple-600 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-slate-700">{suggestion.action}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Lightbulb className="size-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600">No major gaps detected - formulation is well-matched to dairy benchmark!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

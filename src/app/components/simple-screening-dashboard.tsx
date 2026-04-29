import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { CheckCircle2, XCircle, AlertTriangle, DollarSign, Clock } from "lucide-react";
import {
  evaluateEscalation,
  getTaskSummary,
  evaluateOffNoteDetection,
} from "../utils/task-evaluators";

export function SimpleScreeningDashboard() {
  const escalationDecision = evaluateEscalation();
  const taskSummary = getTaskSummary();
  const offNoteResult = evaluateOffNoteDetection();
  
  const needsPanel = escalationDecision.escalationRequired;

  return (
    <div className="max-w-[1200px] mx-auto">
      {/* Clear Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-medium text-slate-900 mb-3">
          Do You Need a Trained Sensory Panel?
        </h1>
        <p className="text-lg text-slate-600">
          Based on your 10 cheese samples tested with instruments + quick sensory screening
        </p>
      </div>

      {/* BIG ANSWER CARD */}
      <Card className={`mb-8 shadow-2xl border-4 ${
        needsPanel 
          ? 'border-rose-500 bg-gradient-to-br from-rose-50 via-white to-rose-50'
          : 'border-emerald-500 bg-gradient-to-br from-emerald-50 via-white to-emerald-50'
      }`}>
        <CardContent className="pt-8 pb-8">
          <div className="text-center">
            <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full mb-6 shadow-lg ${
              needsPanel ? 'bg-rose-100' : 'bg-emerald-100'
            }`}>
              {needsPanel 
                ? <XCircle className="size-16 text-rose-600" />
                : <CheckCircle2 className="size-16 text-emerald-600" />
              }
            </div>
            
            <h2 className={`text-5xl font-bold mb-4 ${
              needsPanel ? 'text-rose-900' : 'text-emerald-900'
            }`}>
              {needsPanel ? 'YES' : 'NO'}
            </h2>
            
            <p className={`text-2xl mb-6 ${
              needsPanel ? 'text-rose-700' : 'text-emerald-700'
            }`}>
              {needsPanel 
                ? 'You need a full trained sensory panel'
                : 'Your screening is good enough - no panel needed yet'
              }
            </p>

            <div className="max-w-2xl mx-auto">
              <div className="p-6 bg-white rounded-xl border-2 border-slate-200 mb-6">
                <p className="text-lg text-slate-700 leading-relaxed">
                  {needsPanel 
                    ? 'Your instruments and quick screening detected a problem they can\'t fully characterize. You need expert sensory panelists to properly evaluate these samples before making product decisions.'
                    : 'Your instrumental measurements and quick sensory checks agree well enough that you can trust them for now. Save the expensive trained panel for later stages.'
                  }
                </p>
              </div>

              {/* Cost/Time Info */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-300">
                  <div className="flex items-center gap-2 text-slate-600 mb-1">
                    <DollarSign className="size-5" />
                    <span className="text-sm font-semibold">Cost Impact</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">
                    {needsPanel ? '$10k-$50k' : '$2k'}
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    {needsPanel ? 'Full trained panel' : 'Screening only'}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-lg border border-slate-300">
                  <div className="flex items-center gap-2 text-slate-600 mb-1">
                    <Clock className="size-5" />
                    <span className="text-sm font-semibold">Timeline</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">
                    {needsPanel ? '4-12 weeks' : '1 week'}
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    {needsPanel ? 'Panel recruitment + testing' : 'Current screening'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* WHY? */}
      <Card className="mb-8 shadow-lg border-slate-200">
        <CardHeader>
          <CardTitle className="text-2xl">Why {needsPanel ? 'do you need' : 'don\'t you need'} a panel?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Problem Detection */}
            {needsPanel && offNoteResult.status === 'FAIL' && (
              <div className="p-5 bg-rose-50 border-2 border-rose-300 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="size-6 text-rose-600 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-bold text-rose-900 text-lg mb-2">Problem: Off-notes detected</h3>
                    <p className="text-slate-700 mb-3">
                      Your quick sensory panel flagged samples with rancid/unpleasant odors, but your instrumental measurements didn't predict this accurately.
                    </p>
                    <div className="bg-white p-3 rounded-lg border border-rose-200">
                      <div className="font-semibold text-sm text-slate-900 mb-2">Specific issues:</div>
                      <div className="space-y-1">
                        {offNoteResult.falseNegatives.map((msg, idx) => (
                          <div key={idx} className="text-sm text-rose-700">• {msg}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* What this means */}
            <div className="p-5 bg-blue-50 border-2 border-blue-300 rounded-xl">
              <h3 className="font-bold text-blue-900 text-lg mb-3">What this means for you:</h3>
              <div className="bg-white p-4 rounded-lg border border-blue-200">
                <p className="text-slate-700 text-base leading-relaxed">
                  {escalationDecision.recommendation}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Simple Test Results */}
      <Card className="shadow-lg border-slate-200">
        <CardHeader>
          <CardTitle className="text-2xl">What we checked (simple version):</CardTitle>
          <p className="text-sm text-slate-500 mt-2">
            We tested 4 things to see if your instruments are good enough
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Test 1 */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border-2 border-slate-200">
              <div className="flex items-center gap-3">
                {taskSummary.intensityScaling.status === 'PASS' 
                  ? <CheckCircle2 className="size-6 text-emerald-600" />
                  : <XCircle className="size-6 text-rose-600" />
                }
                <div>
                  <div className="font-semibold text-slate-900">Intensity Measurement</div>
                  <div className="text-sm text-slate-600">
                    Do instruments measure taste/aroma strength accurately?
                  </div>
                </div>
              </div>
              <Badge className={
                taskSummary.intensityScaling.status === 'PASS' 
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 text-base px-4 py-2'
                  : 'bg-rose-100 text-rose-800 border-rose-300 text-base px-4 py-2'
              }>
                {taskSummary.intensityScaling.status === 'PASS' ? '✓ Good' : '✗ Problem'}
              </Badge>
            </div>

            {/* Test 2 */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border-2 border-slate-200">
              <div className="flex items-center gap-3">
                {taskSummary.rankOrdering.status === 'PASS' 
                  ? <CheckCircle2 className="size-6 text-emerald-600" />
                  : <XCircle className="size-6 text-rose-600" />
                }
                <div>
                  <div className="font-semibold text-slate-900">Sample Ranking</div>
                  <div className="text-sm text-slate-600">
                    Can instruments correctly rank which samples are stronger/weaker?
                  </div>
                </div>
              </div>
              <Badge className={
                taskSummary.rankOrdering.status === 'PASS' 
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 text-base px-4 py-2'
                  : 'bg-rose-100 text-rose-800 border-rose-300 text-base px-4 py-2'
              }>
                {taskSummary.rankOrdering.status === 'PASS' ? '✓ Good' : '✗ Problem'}
              </Badge>
            </div>

            {/* Test 3 - THE CRITICAL ONE */}
            <div className={`flex items-center justify-between p-4 rounded-lg border-2 ${
              taskSummary.offNoteDetection.status === 'PASS'
                ? 'bg-slate-50 border-slate-200'
                : 'bg-rose-100 border-rose-400'
            }`}>
              <div className="flex items-center gap-3">
                {taskSummary.offNoteDetection.status === 'PASS' 
                  ? <CheckCircle2 className="size-6 text-emerald-600" />
                  : <XCircle className="size-6 text-rose-600" />
                }
                <div>
                  <div className="font-semibold text-slate-900">Off-Note Detection (CRITICAL)</div>
                  <div className="text-sm text-slate-600">
                    Can instruments catch rancid/bad odors that would make product unacceptable?
                  </div>
                </div>
              </div>
              <Badge className={
                taskSummary.offNoteDetection.status === 'PASS' 
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 text-base px-4 py-2'
                  : 'bg-rose-100 text-rose-800 border-rose-300 text-base px-4 py-2'
              }>
                {taskSummary.offNoteDetection.status === 'PASS' ? '✓ Good' : '✗ PROBLEM'}
              </Badge>
            </div>

            {/* Test 4 */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border-2 border-slate-200">
              <div className="flex items-center gap-3">
                {taskSummary.textureProxy.status === 'PASS' 
                  ? <CheckCircle2 className="size-6 text-emerald-600" />
                  : <XCircle className="size-6 text-rose-600" />
                }
                <div>
                  <div className="font-semibold text-slate-900">Texture Prediction</div>
                  <div className="text-sm text-slate-600">
                    Does firmness measurement match what people actually feel?
                  </div>
                </div>
              </div>
              <Badge className={
                taskSummary.textureProxy.status === 'PASS' 
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 text-base px-4 py-2'
                  : 'bg-rose-100 text-rose-800 border-rose-300 text-base px-4 py-2'
              }>
                {taskSummary.textureProxy.status === 'PASS' ? '✓ Good' : '✗ Problem'}
              </Badge>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-slate-700">
              <strong className="text-blue-900">Bottom line:</strong> If ANY of these tests fail (especially off-note detection), you need expert sensory panelists. If they all pass, your screening is good enough for now.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

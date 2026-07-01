import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { QUALITY_STANDARDS } from "../data/quality-standards";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

interface QualityStandardsCardProps {
  compact?: boolean;
}

export function QualityStandardsCard({ compact = false }: QualityStandardsCardProps) {
  if (compact) {
    return (
      <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-slate-50">
        <CardContent className="pt-4">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <CheckCircle2 className="size-5 text-emerald-600 mx-auto mb-1" />
              <div className="font-bold text-emerald-900">GO</div>
              <div className="text-xs text-slate-700 mt-1">Hedonic ≥7.0</div>
              <div className="text-xs text-slate-700">Emotion +2.0</div>
            </div>
            <div className="text-center">
              <AlertTriangle className="size-5 text-amber-600 mx-auto mb-1" />
              <div className="font-bold text-amber-900">TWEAK</div>
              <div className="text-xs text-slate-700 mt-1">Hedonic 5.0-6.9</div>
              <div className="text-xs text-slate-700">Emotion 0-1.9</div>
            </div>
            <div className="text-center">
              <XCircle className="size-5 text-rose-600 mx-auto mb-1" />
              <div className="font-bold text-rose-900">STOP</div>
              <div className="text-xs text-slate-700 mt-1">Hedonic &lt;5.0</div>
              <div className="text-xs text-slate-700">Defects detected</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-blue-300 bg-gradient-to-r from-blue-50 to-slate-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <CheckCircle2 className="size-5 text-blue-600" />
          Quality Standards Reference
        </CardTitle>
        <p className="text-xs text-slate-700">Decision criteria for GO / TWEAK / STOP outcomes</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Hedonic Score */}
          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-slate-900">Hedonic Overall Score</span>
              <Badge className="bg-blue-600">Primary Metric</Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="p-2 bg-emerald-50 rounded border border-emerald-200">
                <div className="font-bold text-emerald-900">GO: ≥{QUALITY_STANDARDS.hedonic.go}/9</div>
                <div className="text-xs text-emerald-700">Like moderately+</div>
              </div>
              <div className="p-2 bg-amber-50 rounded border border-amber-200">
                <div className="font-bold text-amber-900">TWEAK: {QUALITY_STANDARDS.hedonic.tweak}-6.9/9</div>
                <div className="text-xs text-amber-700">Neither/Like slightly</div>
              </div>
              <div className="p-2 bg-rose-50 rounded border border-rose-200">
                <div className="font-bold text-rose-900">STOP: &lt;{QUALITY_STANDARDS.hedonic.tweak}/9</div>
                <div className="text-xs text-rose-700">Dislike</div>
              </div>
            </div>
            <div className="text-xs text-slate-500 mt-2 italic">{QUALITY_STANDARDS.hedonic.description}</div>
          </div>

          {/* Emotional Balance */}
          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-slate-900">Emotional Balance</span>
              <Badge className="bg-purple-600">EsSense25</Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="p-2 bg-emerald-50 rounded border border-emerald-200">
                <div className="font-bold text-emerald-900">GO: ≥+{QUALITY_STANDARDS.emotionalBalance.go}</div>
                <div className="text-xs text-emerald-700">Positive dominant</div>
              </div>
              <div className="p-2 bg-amber-50 rounded border border-amber-200">
                <div className="font-bold text-amber-900">TWEAK: 0-1.9</div>
                <div className="text-xs text-amber-700">Mixed response</div>
              </div>
              <div className="p-2 bg-rose-50 rounded border border-rose-200">
                <div className="font-bold text-rose-900">STOP: &lt;0</div>
                <div className="text-xs text-rose-700">Negative dominant</div>
              </div>
            </div>
            <div className="text-xs text-slate-500 mt-2 italic">{QUALITY_STANDARDS.emotionalBalance.description}</div>
          </div>

          {/* Off-Notes */}
          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-slate-900">Off-Note Detection</span>
              <Badge className="bg-rose-600">GC-Olfactometry</Badge>
            </div>
            <div className="text-sm space-y-1">
              <div className="flex items-center gap-2">
                <XCircle className="size-4 text-rose-600 flex-shrink-0" />
                <span className="text-slate-700">STOP if defects (rancid, cardboard) with odour intensity ≥{QUALITY_STANDARDS.offNotes.maxOdourIntensity}/5</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="size-4 text-rose-600 flex-shrink-0" />
                <span className="text-slate-700">STOP if concentration exceeds sensory threshold</span>
              </div>
            </div>
            <div className="text-xs text-slate-500 mt-2 italic">{QUALITY_STANDARDS.offNotes.description}</div>
          </div>

          {/* CATA Agreement */}
          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-slate-900">Panel Agreement (CATA)</span>
              <Badge className="bg-blue-600">n=14 panelists</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="p-2 bg-emerald-50 rounded border border-emerald-200">
                <div className="font-bold text-emerald-900">Strong: ≥{QUALITY_STANDARDS.cataAgreement.strong}%</div>
                <div className="text-xs text-emerald-700">Clear consensus</div>
              </div>
              <div className="p-2 bg-amber-50 rounded border border-amber-200">
                <div className="font-bold text-amber-900">Moderate: {QUALITY_STANDARDS.cataAgreement.moderate}-59%</div>
                <div className="text-xs text-amber-700">Mixed opinions</div>
              </div>
            </div>
            <div className="text-xs text-slate-500 mt-2 italic">{QUALITY_STANDARDS.cataAgreement.description}</div>
          </div>

          {/* Correlation */}
          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-slate-900">Instrumental-Sensory Correlation</span>
              <Badge className="bg-purple-600">Validation</Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="p-2 bg-emerald-50 rounded border border-emerald-200">
                <div className="font-bold text-emerald-900">Strong: r ≥{QUALITY_STANDARDS.correlation.strong}</div>
              </div>
              <div className="p-2 bg-amber-50 rounded border border-amber-200">
                <div className="font-bold text-amber-900">Moderate: r {QUALITY_STANDARDS.correlation.moderate}-0.84</div>
              </div>
              <div className="p-2 bg-rose-50 rounded border border-rose-200">
                <div className="font-bold text-rose-900">Weak: r &lt;{QUALITY_STANDARDS.correlation.moderate}</div>
              </div>
            </div>
            <div className="text-xs text-slate-500 mt-2 italic">{QUALITY_STANDARDS.correlation.description}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

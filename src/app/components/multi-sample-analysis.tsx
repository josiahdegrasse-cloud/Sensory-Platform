import { STATUS } from '../styles/tokens';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from "recharts";
import { AlertTriangle, CheckCircle2, Download, Heart, Layers, Target, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { DataProvenanceBadge } from './data-provenance-badge';
import { InsightInterpretationBlock } from './insights-ui';
import { analyzeMultiSampleStudy, type MultiSampleSessionLike } from '../lib/multi-sample-analysis';

interface MultiSampleProduct {
  id: string;
  name: string;
  category?: string;
  isMultiSample?: boolean;
}

interface MultiSampleAnalysisProps {
  multiSampleResponses: MultiSampleSessionLike[];
  multiSampleProducts: MultiSampleProduct[];
  selectedMultiProduct: string;
  setSelectedMultiProduct: (id: string) => void;
  minimumResponses?: number;
}

function scoreTone(score: number) {
  if (score >= 7) return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  if (score >= 5) return 'border-amber-200 bg-amber-50 text-amber-900';
  return 'border-rose-200 bg-rose-50 text-rose-900';
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function MultiSampleAnalysis({
  multiSampleResponses,
  multiSampleProducts,
  selectedMultiProduct,
  setSelectedMultiProduct,
  minimumResponses = 12,
}: MultiSampleAnalysisProps) {
  const selectedProduct = multiSampleProducts.find(p => p.id === selectedMultiProduct);
  const productResponses = multiSampleResponses.filter(r => r.productId === selectedMultiProduct);
  const analysis = analyzeMultiSampleStudy(productResponses, minimumResponses);

  if (productResponses.length === 0) {
    return (
      <Card className="border border-slate-200">
        <CardContent className="pt-12 pb-12 text-center">
          <Layers className="size-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-700 mb-2">No Multi-Sample Data Yet</h3>
          <p className="text-slate-600">
            Multi-sample evaluation responses will appear here once panelists complete them.
          </p>
        </CardContent>
      </Card>
    );
  }

  const evidenceIsLimited = analysis.summary.evidenceTone === 'limited';
  const differenceChartData = analysis.differenceRows.map(row => ({
    sample: row.sampleCode,
    selections: row.count,
    share: Math.round(row.share * 100),
  }));
  const rankingChartData = analysis.rankingRows.map(row => ({
    sample: row.sampleCode,
    'Ranked #1': Math.round(row.firstPlaceShare * 100),
    'Average rank': row.averageRank ?? 0,
  }));
  const hedonicChartData = analysis.hedonicRows.map(row => ({
    sample: row.sampleCode,
    avgScore: Number(row.averageOverall.toFixed(2)),
    count: row.count,
  }));

  const exportMultiSampleCSV = () => {
    const headers = ['ResponseID', 'PanelistID', 'ProductID', 'SampleCode', 'Metric', 'Value'];
    const rows: string[] = [headers.join(',')];

    productResponses.forEach((response) => {
      // Discrimination
      rows.push(`${response.id},${response.userId},${response.productId},N/A,Discrimination,${response.differentSample}`);

      // Ranking
      response.ranking.forEach((code: string, idx: number) => {
        rows.push(`${response.id},${response.userId},${response.productId},${code},Ranking,${idx + 1}`);
      });

      // Sample data
      response.samples.forEach((sample) => {
        rows.push(`${response.id},${response.userId},${response.productId},${sample.sampleCode},HedonicOverall,${sample.hedonicScores.overall}`);
      });
    });

    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `multi-sample-${selectedProduct?.name || 'analysis'}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <Card className="border border-slate-200">
        <CardHeader className="border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Layers className="size-5 text-blue-600" />
                Select Multi-Sample Study
              </CardTitle>
              <p className="text-sm text-slate-600 mt-1">{productResponses.length} panelist responses</p>
            </div>
            <div className="flex items-center gap-2">
              <DataProvenanceBadge provenance="live" n={productResponses.length} />
              <Button onClick={exportMultiSampleCSV} variant="outline">
                <Download className="size-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 gap-3">
            {multiSampleProducts.map(product => (
              <button
                key={product.id}
                onClick={() => setSelectedMultiProduct(product.id)}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  selectedMultiProduct === product.id
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="font-bold text-slate-900">{product.name}</div>
                <div className="text-xs text-slate-600 mt-1">{product.category}</div>
                <div className="text-xs text-blue-700 mt-1 font-medium">
                  {multiSampleResponses.filter(r => r.productId === product.id).length} responses
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border border-slate-200">
        <CardHeader className="border-b border-slate-100">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                {analysis.summary.preferenceAgreement ? (
                  <CheckCircle2 className="size-5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="size-5 text-amber-600" />
                )}
                Multi-sample decision readout
              </CardTitle>
              <p className="mt-1 text-sm text-slate-600">
                Difference evidence is reported as consensus, not formal triangle accuracy.
              </p>
            </div>
            <DataProvenanceBadge provenance="live" n={productResponses.length} />
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Evidence</div>
              <div className="mt-2 text-lg font-bold text-slate-950">{analysis.summary.evidenceLabel}</div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">Different sample</div>
              <div className="mt-2 text-lg font-bold text-amber-950">{analysis.summary.differenceLeader ?? 'Mixed'}</div>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">Preference leader</div>
              <div className="mt-2 text-lg font-bold text-blue-950">{analysis.summary.preferenceLeader ?? 'Not established'}</div>
            </div>
            <div className={`rounded-lg border p-4 ${analysis.summary.preferenceAgreement ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
              <div className={`text-xs font-semibold uppercase tracking-wide ${analysis.summary.preferenceAgreement ? 'text-emerald-700' : 'text-amber-700'}`}>Decision state</div>
              <div className={`mt-2 text-lg font-bold ${analysis.summary.preferenceAgreement ? 'text-emerald-950' : 'text-amber-950'}`}>
                {analysis.summary.preferenceAgreement ? 'Aligned' : 'Needs review'}
              </div>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <InsightInterpretationBlock
              tone={evidenceIsLimited || !analysis.summary.preferenceAgreement ? 'warning' : 'info'}
              finding={analysis.summary.preferenceSignal}
              evidence={analysis.summary.differenceSignal}
              confidence={analysis.summary.evidenceLabel}
              action={analysis.summary.nextAction}
            />
            <InsightInterpretationBlock
              tone="info"
              finding={analysis.summary.driverSignal}
              evidence="Attribute drivers are based on CATA selections from the per-sample evaluations."
              confidence="Use as diagnostic evidence; confirm with formulation and instrumental data before claims."
              action="Compare the leading descriptors with the prototype objective and known formulation changes."
            />
          </div>
        </CardContent>
      </Card>

      {evidenceIsLimited && (
        <InsightInterpretationBlock
          tone="warning"
          finding="The multi-sample results are directional."
          evidence={`${productResponses.length} completed multi-sample response${productResponses.length === 1 ? '' : 's'} are available.`}
          confidence="Low until the configured panel threshold is reached."
          action="Collect more responses before naming a preferred sample or presenting the result as representative."
        />
      )}

      <Card className="border border-slate-200">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="flex items-center gap-2">
            <Target className="size-5 text-amber-600" />
            Difference consensus
          </CardTitle>
          <p className="text-sm text-slate-600">Which sample was identified as different. This is not formal accuracy without a hidden answer key.</p>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {analysis.differenceRows.map(row => (
              <div key={row.sampleCode} className="rounded-lg border-2 border-amber-200 bg-amber-50 p-4 text-center">
                <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-amber-600 text-xl font-bold text-white">
                  {row.sampleCode}
                </div>
                <div className="text-3xl font-bold text-amber-900">{row.count}</div>
                <div className="text-sm text-slate-600">({percent(row.share)})</div>
                <div className="mt-1 text-xs text-slate-500">panelists selected</div>
              </div>
            ))}
          </div>
          <div className="mt-5 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={differenceChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="sample" />
                <YAxis />
                <RechartsTooltip />
                <Bar dataKey="share" fill={STATUS.tweak} name="Selected as different (%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-slate-200">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="size-5 text-blue-600" />
            Preference ranking
          </CardTitle>
          <p className="text-sm text-slate-600">First-place share and average rank across completed sessions.</p>
        </CardHeader>
        <CardContent className="pt-6">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={rankingChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="sample" />
              <YAxis />
              <RechartsTooltip />
              <Legend />
              <Bar key="rank-best" dataKey="Ranked #1" fill={STATUS.go} name="Ranked #1 (%)" />
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {analysis.rankingRows.map(row => (
              <div key={row.sampleCode} className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
                <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">
                  {row.sampleCode}
                </div>
                <div className="mb-1 text-sm text-slate-600">Ranked #1</div>
                <div className="text-2xl font-bold text-blue-900">{percent(row.firstPlaceShare)}</div>
                <div className="mt-1 text-xs text-slate-500">
                  Avg rank {row.averageRank?.toFixed(1) ?? 'n/a'} · {row.firstPlaceCount}/{row.totalRankings}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border border-slate-200">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="flex items-center gap-2">
            <Heart className="size-5 text-blue-600" />
            Average overall liking
          </CardTitle>
          <p className="text-sm text-slate-600">Mean hedonic scores (1-9 scale)</p>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {hedonicChartData.map((data) => {
              return (
                <div key={data.sample} className={`rounded-lg border-2 p-4 text-center ${scoreTone(data.avgScore)}`}>
                  <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-purple-600 text-xl font-bold text-white">
                    {data.sample}
                  </div>
                  <div className="text-3xl font-bold">{data.avgScore.toFixed(2)}</div>
                  <div className="mt-1 text-xs text-slate-500">n={data.count} observations</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border border-slate-200">
        <CardHeader className="border-b border-slate-100">
          <CardTitle>Attribute drivers by sample</CardTitle>
          <p className="text-sm text-slate-600">Top selected descriptors from the per-sample CATA task.</p>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {analysis.sampleCodes.map(code => {
              const drivers = analysis.attributeDrivers.filter(driver => driver.sampleCode === code);
              return (
                <div key={code} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex size-9 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">{code}</div>
                    <div className="font-semibold text-slate-900">Sample {code}</div>
                  </div>
                  {drivers.length > 0 ? (
                    <div className="space-y-2">
                      {drivers.map(driver => (
                        <div key={`${driver.sampleCode}-${driver.attribute}`} className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-slate-700">{driver.attribute}</span>
                          <span className="font-semibold text-slate-950">{percent(driver.share)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No descriptors selected yet.</p>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

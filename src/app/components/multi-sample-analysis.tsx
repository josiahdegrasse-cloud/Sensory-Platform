import { STATUS } from '../styles/tokens';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from "recharts";
import { Layers, Target, Trophy, Heart, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { DataProvenanceBadge } from './data-provenance-badge';
import { InsightInterpretationBlock } from './insights-ui';

interface MultiSampleProduct {
  id: string;
  name: string;
  category?: string;
  isMultiSample?: boolean;
}

interface SampleData {
  sampleCode: string;
  cataAttributes: string[];
  intensityRatings: Record<string, number>;
  hedonicScores: { overall: number; [key: string]: number };
  emotionalProfile: Record<string, number>;
}

interface MultiSampleSession {
  id: string;
  userId: string;
  productId: string;
  differentSample: string;
  ranking: string[];
  samples: SampleData[];
}

interface MultiSampleAnalysisProps {
  multiSampleResponses: MultiSampleSession[];
  multiSampleProducts: MultiSampleProduct[];
  selectedMultiProduct: string;
  setSelectedMultiProduct: (id: string) => void;
  minimumResponses?: number;
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

  // Calculate discrimination accuracy
  const discriminationResults = productResponses.reduce((acc: Record<string, number>, response) => {
    const sample = response.differentSample;
    acc[sample] = (acc[sample] || 0) + 1;
    return acc;
  }, {});

  // Calculate ranking consensus
  const rankingData = productResponses.reduce((acc: Record<string, { rank1: number; rank2: number; rank3: number; total: number }>, response) => {
    response.ranking.forEach((sampleCode: string, position: number) => {
      if (!acc[sampleCode]) {
        acc[sampleCode] = { rank1: 0, rank2: 0, rank3: 0, total: 0 };
      }
      const rankKey = `rank${position + 1}` as 'rank1' | 'rank2' | 'rank3';
      if (rankKey in acc[sampleCode]) {
        acc[sampleCode][rankKey]++;
      }
      acc[sampleCode].total++;
    });
    return acc;
  }, {});

  const rankingChartData = Object.entries(rankingData).map(([code, data]) => ({
    id: `ranking-${code}`,
    sample: code,
    'Best (1st)': data.rank1,
    'Middle (2nd)': data.rank2,
    'Worst (3rd)': data.rank3
  }));

  // Average hedonic scores per sample
  const hedonicBySample = productResponses.reduce((acc: Record<string, { scores: number[]; count: number }>, response) => {
    response.samples.forEach((sample) => {
      if (!acc[sample.sampleCode]) {
        acc[sample.sampleCode] = { scores: [], count: 0 };
      }
      acc[sample.sampleCode].scores.push(sample.hedonicScores.overall);
      acc[sample.sampleCode].count++;
    });
    return acc;
  }, {});

  const hedonicChartData = Object.entries(hedonicBySample).map(([code, data]) => ({
    id: `hedonic-sample-${code}`,
    sample: code,
    avgScore: (data.scores.reduce((a: number, b: number) => a + b, 0) / data.count).toFixed(2),
    count: data.count
  })).sort((a, b) => parseFloat(b.avgScore) - parseFloat(a.avgScore));
  const evidenceIsLimited = productResponses.length < minimumResponses;
  const leadingSample = hedonicChartData[0];

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
      {/* Product Selector */}
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

      {/* Discrimination Test Results */}
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
            Discrimination Test Results
          </CardTitle>
          <p className="text-sm text-slate-600">Which sample was identified as "different"</p>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(discriminationResults).map(([sampleCode, count]) => {
              const percentage = ((count / productResponses.length) * 100).toFixed(1);
              return (
                <div key={sampleCode} className="p-4 bg-amber-50 rounded-lg border-2 border-amber-200 text-center">
                  <div className="w-14 h-14 rounded-full bg-amber-600 text-white flex items-center justify-center font-bold text-xl mx-auto mb-2">
                    {sampleCode}
                  </div>
                  <div className="text-3xl font-bold text-amber-900">{count}</div>
                  <div className="text-sm text-slate-600">({percentage}%)</div>
                  <div className="text-xs text-slate-500 mt-1">panelists selected</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Preference Ranking */}
      <Card className="border border-slate-200">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="size-5 text-blue-600" />
            Preference Ranking Distribution
          </CardTitle>
          <p className="text-sm text-slate-600">How panelists ranked each sample</p>
        </CardHeader>
        <CardContent className="pt-6">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={rankingChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="sample" />
              <YAxis />
              <RechartsTooltip />
              <Legend />
              <Bar key="rank-best" dataKey="Best (1st)" fill={STATUS.go} />
              <Bar key="rank-middle" dataKey="Middle (2nd)" fill={STATUS.tweak} />
              <Bar key="rank-worst" dataKey="Worst (3rd)" fill={STATUS.stop} />
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-6 grid grid-cols-3 gap-4">
            {rankingChartData.map((data) => {
              const bestCount = data['Best (1st)'];
              const total = bestCount + data['Middle (2nd)'] + data['Worst (3rd)'];
              const percentage = ((bestCount / total) * 100).toFixed(1);
              return (
                <div key={data.sample} className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center">
                  <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg mx-auto mb-2">
                    {data.sample}
                  </div>
                  <div className="text-sm text-slate-600 mb-1">Ranked #1</div>
                  <div className="text-2xl font-bold text-blue-900">{percentage}%</div>
                  <div className="text-xs text-slate-500 mt-1">{bestCount}/{total} times</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Average Hedonic Scores */}
      <Card className="border border-slate-200">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="flex items-center gap-2">
            <Heart className="size-5 text-blue-600" />
            Average Overall Liking by Sample
          </CardTitle>
          <p className="text-sm text-slate-600">Mean hedonic scores (1-9 scale)</p>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4">
            {hedonicChartData.map((data) => {
              const score = parseFloat(data.avgScore);
              const color = score >= 7 ? 'emerald' : score >= 5 ? 'amber' : 'rose';
              return (
                <div key={data.sample} className={`p-4 bg-${color}-50 rounded-lg border-2 border-${color}-200 text-center`}>
                  <div className="w-14 h-14 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-xl mx-auto mb-2">
                    {data.sample}
                  </div>
                  <div className={`text-3xl font-bold text-${color}-900`}>{data.avgScore}</div>
                  <div className="text-xs text-slate-500 mt-1">n={data.count} responses</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {leadingSample && (
        <InsightInterpretationBlock
          tone={evidenceIsLimited ? 'warning' : 'info'}
          finding={evidenceIsLimited
            ? `${leadingSample.sample} is the current leading direction, not a validated winner.`
            : `${leadingSample.sample} has the highest average liking score in this study.`}
          evidence={`${leadingSample.avgScore}/9 average liking across ${leadingSample.count} observations.`}
          confidence={evidenceIsLimited ? 'Limited because the study has not reached the response threshold.' : 'Moderate; confirm study design and statistical testing before making broad claims.'}
          action={evidenceIsLimited ? 'Continue response collection.' : 'Review the leading sample alongside discrimination and ranking results.'}
        />
      )}
    </div>
  );
}

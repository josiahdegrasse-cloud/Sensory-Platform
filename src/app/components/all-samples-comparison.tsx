import { STATUS } from '../styles/tokens';
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis,
  Tooltip as RechartsTooltip, Legend
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { getSampleColor, SAMPLE_TYPE_LEGEND } from "../utils/sample-colors";

interface AllSampleHedonic {
  id: string;
  name: string;
  overall: number;
  flavour: number;
  texture: number;
  appearance: number;
}

interface EnhancedSampleLike {
  sampleId: string;
  sampleName: string;
  hedonic: { overall: number; flavour: number; texture: number; appearance: number };
}

interface AllSamplesComparisonViewProps {
  allSamplesHedonic: AllSampleHedonic[];
  enhancedSensoryData: EnhancedSampleLike[];
}

export function AllSamplesComparisonView({ allSamplesHedonic, enhancedSensoryData }: AllSamplesComparisonViewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>All Samples: Hedonic Comparison</CardTitle>
        <p className="text-sm text-slate-600">
          Comparative view of all 14 samples across hedonic dimensions
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={allSamplesHedonic}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis domain={[0, 9]} />
            <RechartsTooltip />
            <Legend />
            <Line key="line-overall" type="monotone" dataKey="overall" stroke="#8b5cf6" strokeWidth={2} name="Overall" />
            <Line key="line-flavour" type="monotone" dataKey="flavour" stroke={STATUS.info} strokeWidth={2} name="Flavour" />
            <Line key="line-texture" type="monotone" dataKey="texture" stroke={STATUS.go} strokeWidth={2} name="Texture" />
            <Line key="line-appearance" type="monotone" dataKey="appearance" stroke={STATUS.tweak} strokeWidth={2} name="Appearance" />
          </LineChart>
        </ResponsiveContainer>

        <div className="mt-4 flex flex-wrap gap-3 px-1">
          {SAMPLE_TYPE_LEGEND.map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-slate-600">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              {label}
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-7 gap-3">
          {enhancedSensoryData.map(sample => {
            const avgScore = (sample.hedonic.overall + sample.hedonic.flavour +
                             sample.hedonic.texture + sample.hedonic.appearance) / 4;
            const typeColor = getSampleColor(sample.sampleName);
            return (
              <div
                key={sample.sampleId}
                className="p-3 rounded-lg border-2 text-center"
                style={{ borderColor: typeColor, backgroundColor: `${typeColor}18` }}
              >
                <div className="font-bold text-slate-900 text-xs mb-1 leading-tight">{sample.sampleName}</div>
                <div className="text-2xl font-bold mt-1" style={{ color: typeColor }}>{avgScore.toFixed(1)}</div>
                <div className="text-xs text-slate-500 mt-1">/ 9</div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

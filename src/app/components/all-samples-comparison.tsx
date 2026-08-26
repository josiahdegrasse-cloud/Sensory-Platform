import { STATUS } from '../styles/tokens';
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis,
  Tooltip as RechartsTooltip, Legend
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { getSampleColor } from "../utils/sample-colors";
import { DataProvenanceBadge } from './data-provenance-badge';

interface AllSampleHedonic {
  id: string;
  name: string;
  overall: number;
  flavour: number;
  texture: number;
  appearance: number;
}

interface AllSamplesComparisonViewProps {
  allSamplesHedonic: AllSampleHedonic[];
  usingLiveData: boolean;
  responseCount: number;
}

export function AllSamplesComparisonView({
  allSamplesHedonic,
  usingLiveData,
  responseCount,
}: AllSamplesComparisonViewProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle>Project sample comparison</CardTitle>
          <DataProvenanceBadge provenance={usingLiveData ? 'live' : 'reference'} n={responseCount} />
        </div>
        <p className="text-sm text-slate-700">
          Comparative view of the {allSamplesHedonic.length} samples in the active project across liking dimensions.
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

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {allSamplesHedonic.map(sample => {
            const avgScore = (sample.overall + sample.flavour + sample.texture + sample.appearance) / 4;
            const typeColor = getSampleColor(sample.name);
            return (
              <div
                key={sample.id}
                className="p-3 rounded-lg border-2 text-center"
                style={{ borderColor: typeColor, backgroundColor: `${typeColor}18` }}
              >
                <div className="font-bold text-slate-900 text-xs mb-1 leading-tight">{sample.name}</div>
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

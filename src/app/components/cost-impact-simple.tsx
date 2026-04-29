import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Slider } from "./ui/slider";
import { DollarSign, Clock, Award, TrendingUp } from "lucide-react";

export function CostImpactSimple() {
  const [substitutionRate, setSubstitutionRate] = useState([70]);

  // Base data
  const issfCostPerSample = 3200;
  const trainedCostPerSample = 12400;
  const totalSamplesPerYear = 120;

  // Calculate costs based on substitution rate
  const issfSamples = Math.round((substitutionRate[0] / 100) * totalSamplesPerYear);
  const trainedSamples = totalSamplesPerYear - issfSamples;
  
  const issfAnnualCost = issfSamples * issfCostPerSample;
  const trainedAnnualCost = trainedSamples * trainedCostPerSample;
  const totalCost = issfAnnualCost + trainedAnnualCost;
  
  const fullTrainedCost = totalSamplesPerYear * trainedCostPerSample;
  const annualSavings = fullTrainedCost - totalCost;

  // Method comparison data
  const costChartData = [
    {
      method: 'ISSF Screening',
      cost: issfCostPerSample,
    },
    {
      method: 'Trained Panel',
      cost: trainedCostPerSample,
    }
  ];

  // Time estimates
  const issfTime = '2-3 days';
  const trainedTime = '10-14 days';

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-medium text-slate-900">Cost Impact Analysis</h1>
        <p className="text-slate-500 mt-1">
          Economic implications of instrumental substitution
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Section A: Method Comparison */}
        <div className="col-span-7">
          <Card className="shadow-md border-slate-200 h-full">
            <CardHeader>
              <CardTitle>Method Comparison</CardTitle>
              <p className="text-sm text-slate-500">
                ISSF Screening vs. Fully Trained Panel
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-6">
                {/* ISSF Card */}
                <div className="p-5 bg-gradient-to-br from-blue-50 to-white border-2 border-blue-200 rounded-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <DollarSign className="size-5 text-blue-700" />
                    </div>
                    <h3 className="font-semibold text-blue-900">ISSF Screening</h3>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs text-blue-700 font-medium mb-1">Cost per Sample</div>
                      <div className="text-2xl font-bold text-blue-900">${issfCostPerSample.toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="size-4 text-blue-600" />
                      <span className="text-blue-700">{issfTime}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Award className="size-4 text-blue-600" />
                      <span className="text-blue-700">Screening-level</span>
                    </div>
                    <Badge className="bg-blue-500/10 text-blue-700 border-blue-300 w-full justify-center">
                      E-Tongue + Chemical PLSR
                    </Badge>
                  </div>
                </div>

                {/* Trained Panel Card */}
                <div className="p-5 bg-gradient-to-br from-slate-50 to-white border-2 border-slate-200 rounded-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                      <DollarSign className="size-5 text-slate-700" />
                    </div>
                    <h3 className="font-semibold text-slate-900">Trained Panel</h3>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs text-slate-600 font-medium mb-1">Cost per Sample</div>
                      <div className="text-2xl font-bold text-slate-900">${trainedCostPerSample.toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="size-4 text-slate-600" />
                      <span className="text-slate-700">{trainedTime}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Award className="size-4 text-slate-600" />
                      <span className="text-slate-700">Gold standard</span>
                    </div>
                    <Badge className="bg-slate-500/10 text-slate-700 border-slate-300 w-full justify-center">
                      Full Sensory Validation
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Bar Chart */}
              <div className="mt-6">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={costChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="method" tick={{ fontSize: 12 }} />
                    <YAxis 
                      label={{ value: 'Cost ($)', angle: -90, position: 'insideLeft', fontSize: 12 }} 
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => `$${value.toLocaleString()}`}
                    />
                    <Bar dataKey="cost" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded text-sm text-blue-900">
                <strong>Cost Efficiency:</strong> ISSF Screening achieves{' '}
                {(((trainedCostPerSample - issfCostPerSample) / trainedCostPerSample) * 100).toFixed(0)}%{' '}
                cost reduction per sample while maintaining screening-level reliability. Time reduction from weeks to days accelerates R&D iteration cycles.
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Section B: Substitution Rate Simulator */}
        <div className="col-span-5 space-y-6">
          <Card className="shadow-md border-slate-200">
            <CardHeader className="bg-gradient-to-r from-emerald-50 to-white border-b border-emerald-100">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="size-5 text-emerald-600" />
                Substitution Rate Simulator
              </CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                Adjust ISSF substitution rate to see savings
              </p>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-semibold text-slate-700">
                    ISSF Substitution Rate
                  </label>
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-300 font-bold text-lg px-3 py-1">
                    {substitutionRate[0]}%
                  </Badge>
                </div>
                <Slider
                  value={substitutionRate}
                  onValueChange={setSubstitutionRate}
                  min={0}
                  max={100}
                  step={5}
                  className="mb-2"
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>0% (All Trained)</span>
                  <span>100% (All ISSF)</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-4 bg-white rounded-lg border-2 border-slate-200 shadow-sm">
                  <div className="text-xs text-slate-500 font-medium mb-1">Total Samples/Year</div>
                  <div className="text-2xl font-bold text-slate-900">{totalSamplesPerYear}</div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="text-xs text-blue-700 font-medium mb-1">Via ISSF</div>
                    <div className="text-lg font-bold text-blue-900">{issfSamples}</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-xs text-slate-600 font-medium mb-1">Via Panel</div>
                    <div className="text-lg font-bold text-slate-900">{trainedSamples}</div>
                  </div>
                </div>

                <div className="p-4 bg-gradient-to-br from-emerald-50 to-white rounded-lg border-2 border-emerald-200 shadow-sm">
                  <div className="text-xs text-emerald-700 font-medium mb-2">Annual Savings</div>
                  <div className="text-3xl font-bold text-emerald-900">
                    ${(annualSavings / 1000).toFixed(0)}K
                  </div>
                  <div className="text-xs text-emerald-700 mt-2">
                    vs. 100% Trained Panel (${(fullTrainedCost / 1000).toFixed(0)}K)
                  </div>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>ISSF Cost:</span>
                      <span className="font-semibold">${(issfAnnualCost / 1000).toFixed(1)}K</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Panel Cost:</span>
                      <span className="font-semibold">${(trainedAnnualCost / 1000).toFixed(1)}K</span>
                    </div>
                    <div className="flex justify-between border-t border-amber-300 pt-1 mt-1">
                      <span className="font-bold">Total:</span>
                      <span className="font-bold">${(totalCost / 1000).toFixed(1)}K</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                  <strong>Time Savings:</strong> {issfSamples} samples completed in {issfTime} vs. {trainedTime}, 
                  reducing validation timeline by ~{Math.round((issfSamples / totalSamplesPerYear) * 70)}% for ISSF-eligible products.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

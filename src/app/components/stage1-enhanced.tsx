import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { ENHANCED_SENSORY_DATA } from "../data/enhanced-sensory";
import { SAMPLES, SAMPLE_PREP_PROTOCOL } from "../data/samples";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { FlaskConical, Beaker, Microscope, AlertTriangle } from "lucide-react";
import { JargonTooltip } from "./jargon-tooltip";
import { QualityStandardsCard } from "./quality-standards-card";
import { QUALITY_STANDARDS } from "../data/quality-standards";

export function Stage1Enhanced() {
  const [selectedSample, setSelectedSample] = useState<string>("S3");

  const selectedData = ENHANCED_SENSORY_DATA.find(s => s.sampleId === selectedSample);

  // PCA visualization
  const pcaData = ENHANCED_SENSORY_DATA.map((sample, idx) => {
    const pc1 = sample.taste.saltiness * 0.5 + sample.taste.umami * 0.4 - sample.taste.sourness * 0.3;
    const pc2 = sample.taste.bitterness * 0.4 + sample.taste.sourness * 0.35 - sample.taste.sweetness * 0.25;
    const sampleInfo = SAMPLES.find(s => s.id === sample.sampleId);
    return {
      sampleId: sample.sampleId,
      uniqueId: `${sample.sampleId}-${idx}`,
      name: sampleInfo?.name || sample.sampleId,
      pc1: Number(pc1.toFixed(2)),
      pc2: Number(pc2.toFixed(2)),
      category: sampleInfo?.category || "Unknown",
      type: sampleInfo?.type || "pbca"
    };
  });

  const getCategoryColor = (category: string) => {
    if (category === "Dairy") return "#10b981";
    if (category === "Coconut-based") return "#3b82f6";
    if (category === "Cashew-based") return "#f59e0b";
    return "#8b5cf6";
  };

  // Radar chart data - 9 dimensions (TS-5000Z)
  const radarData = selectedData ? [
    { attribute: "Sourness", value: (selectedData.taste.sourness / 10) * 100, fullMark: 100 },
    { attribute: "Bitterness", value: (selectedData.taste.bitterness / 10) * 100, fullMark: 100 },
    { attribute: "Astringency", value: (selectedData.taste.astringency / 10) * 100, fullMark: 100 },
    { attribute: "Umami", value: (selectedData.taste.umami / 10) * 100, fullMark: 100 },
    { attribute: "Saltiness", value: (selectedData.taste.saltiness / 10) * 100, fullMark: 100 },
    { attribute: "Sweetness", value: (selectedData.taste.sweetness / 10) * 100, fullMark: 100 },
    { attribute: "Astrin. After", value: (selectedData.taste.astringencyAftertaste / 10) * 100, fullMark: 100 },
    { attribute: "Umami After", value: (selectedData.taste.umamiAftertaste / 10) * 100, fullMark: 100 },
    { attribute: "Richness", value: (selectedData.taste.richness / 10) * 100, fullMark: 100 },
  ] : [];

  // Check for critical off-notes based on GC-O
  const hasOffNotes = selectedData ? 
    selectedData.gcmsOlfactometry.some(compound => 
      (compound.odourIntensity >= 3 && (
        compound.odour.toLowerCase().includes("rancid") || 
        compound.odour.toLowerCase().includes("cardboard") ||
        compound.odour.toLowerCase().includes("burnt")
      )) ||
      (compound.concentration && compound.threshold && compound.concentration > compound.threshold)
    ) : false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Stage 1: Instrumental Analysis</h1>
        <p className="text-slate-600 mt-2">Insent TS-5000Z E-Tongue | Agilent 7200 Q-TOF GC-MS + PHASER Olfactometer | ISO Chemical Analysis</p>
        <p className="text-xs text-slate-500 mt-1">Sample prep: {SAMPLE_PREP_PROTOCOL.cheese} cheese + {SAMPLE_PREP_PROTOCOL.saline} + {SAMPLE_PREP_PROTOCOL.internalStandard} citronellal ISTD | {SAMPLE_PREP_PROTOCOL.spme} | {SAMPLE_PREP_PROTOCOL.incubation} / {SAMPLE_PREP_PROTOCOL.extraction}</p>
      </div>

      {/* PCA Taste Space */}
      <Card>
        <CardHeader>
          <CardTitle>PCA Taste Space (9-Dimensional E-Tongue)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400} key="pca-chart-container">
            <ScatterChart 
              margin={{ top: 20, right: 30, bottom: 20, left: 20 }}
              id="pca-scatter-chart"
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" dataKey="pc1" name="PC1" domain={[-2, 2]} />
              <YAxis type="number" dataKey="pc2" name="PC2" domain={[-2, 2]} />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white p-3 shadow-xl rounded-lg border border-slate-200">
                        <p className="font-bold text-slate-900">{data.name}</p>
                        <p className="text-xs text-slate-500">PC1: {data.pc1} | PC2: {data.pc2}</p>
                        <p className="text-xs text-slate-600">{data.category}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Scatter 
                key="scatter-pbca"
                name="PBCA" 
                data={pcaData.filter(d => d.type === "pbca")}
                isAnimationActive={false}
                shape={(props: any) => {
                  const { cx, cy, payload, index } = props;
                  return (
                    <circle 
                      key={`pbca-circle-${index}-${payload.uniqueId}`}
                      cx={cx} 
                      cy={cy} 
                      r={6} 
                      fill={getCategoryColor(payload.category)}
                      stroke="#fff"
                      strokeWidth={1}
                    />
                  );
                }}
              />
              <Scatter 
                key="scatter-dairy"
                name="Dairy" 
                data={pcaData.filter(d => d.type === "dairy")}
                isAnimationActive={false}
                shape={(props: any) => {
                  const { cx, cy, payload, index } = props;
                  return (
                    <circle 
                      key={`dairy-circle-${index}-${payload.uniqueId}`}
                      cx={cx} 
                      cy={cy} 
                      r={6} 
                      fill="#10b981"
                      stroke="#fff"
                      strokeWidth={1}
                    />
                  );
                }}
              />
            </ScatterChart>
          </ResponsiveContainer>
          <div className="mt-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-blue-500"></div>
              <span className="text-sm text-slate-700">Coconut-based</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-amber-500"></div>
              <span className="text-sm text-slate-700">Cashew-based</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-purple-500"></div>
              <span className="text-sm text-slate-700">Mixed base</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-emerald-500"></div>
              <span className="text-sm text-slate-700">Dairy Control</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-4 gap-6">
        {/* Sample Selector */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Samples</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {ENHANCED_SENSORY_DATA.map((sample) => {
                const hasDefect = sample.gcmsOlfactometry.some(compound => 
                  (compound.odourIntensity >= 3 && (
                    compound.odour.toLowerCase().includes("rancid") || 
                    compound.odour.toLowerCase().includes("cardboard")
                  )) ||
                  (compound.concentration && compound.threshold && compound.concentration > compound.threshold)
                );
                return (
                  <button
                    key={sample.sampleId}
                    onClick={() => setSelectedSample(sample.sampleId)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                      selectedSample === sample.sampleId
                        ? "border-purple-600 bg-purple-50"
                        : "border-slate-200 hover:border-purple-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm">{sample.sampleName}</span>
                      {hasDefect && <AlertTriangle className="size-5 text-rose-600" />}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Hedonic: {sample.hedonic.overall.toFixed(1)}/9</div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Details Panel */}
        <div className="col-span-3 space-y-6">
          {selectedData && (
            <>
              {/* Multi-dimensional Profile */}
              <div className="grid grid-cols-2 gap-6">
                {/* Taste Radar */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FlaskConical className="size-5 text-purple-600" />
                      Taste Profile (Insent TS-5000Z)
                    </CardTitle>
                    <p className="text-xs text-slate-500 mt-1">9-axis e-tongue (2:5 dilution, 40°C, 7000rpm)</p>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <RadarChart data={radarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="attribute" tick={{ fontSize: 11 }} />
                        <PolarRadiusAxis domain={[0, 100]} />
                        <Radar name="Intensity" dataKey="value" stroke="#9333ea" fill="#9333ea" fillOpacity={0.6} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Chemical Composition */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Beaker className="size-5 text-blue-600" />
                      Chemical Composition (ISO Methods)
                    </CardTitle>
                    <p className="text-xs text-slate-500 mt-1">Gerber-van Gulik (fat) | Kjeldahl (protein) | Argentometric (salt)</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-slate-700">Salt</span>
                          <span className="text-sm font-bold text-blue-600">{selectedData.composition.salt.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 rounded-full" style={{ width: `${(selectedData.composition.salt / 3) * 100}%` }}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-slate-700">Fat</span>
                          <span className="text-sm font-bold text-blue-600">{selectedData.composition.fat.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 rounded-full" style={{ width: `${(selectedData.composition.fat / 30) * 100}%` }}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-slate-700">Protein</span>
                          <span className="text-sm font-bold text-blue-600">{selectedData.composition.protein.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 rounded-full" style={{ width: `${(selectedData.composition.protein / 12) * 100}%` }}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-slate-700">Starch/Dry Matter</span>
                          <span className="text-sm font-bold text-blue-600">{selectedData.composition.starchDryMatter.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 rounded-full" style={{ width: `${(selectedData.composition.starchDryMatter / 20) * 100}%` }}></div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* GC-MS + Olfactometry */}
              <Card className={hasOffNotes ? "border-2 border-rose-400 bg-rose-50" : ""}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    {hasOffNotes && <AlertTriangle className="size-5 text-rose-600" />}
                    Aroma Compounds (Agilent 7200 Q-TOF GC-MS + PHASER Olfactometer)
                  </CardTitle>
                  <p className="text-xs text-slate-500 mt-1">
                    ISTD Recovery: {selectedData.istdRecovery.toFixed(1)}% (10 ng/L citronellal) | 
                    Flow Split: {selectedData.olfactometryFlowSplit}
                  </p>
                </CardHeader>
                <CardContent>
                  {selectedData.gcmsOlfactometry.filter(c => !c.isBlankArtefact).length > 0 ? (
                    <div className="space-y-3">
                      {selectedData.gcmsOlfactometry
                        .filter(compound => !compound.isBlankArtefact)
                        .map((compound, index) => {
                          const isDefect = (compound.odourIntensity >= 3 && (
                            compound.odour.toLowerCase().includes("rancid") || 
                            compound.odour.toLowerCase().includes("cardboard")
                          )) || (compound.concentration && compound.threshold && compound.concentration > compound.threshold);
                          
                          return (
                            <div 
                              key={index} 
                              className={`p-3 rounded-lg border-2 ${
                                isDefect ? "border-rose-300 bg-rose-100" : "border-slate-200 bg-white"
                              }`}
                            >
                              <div className="grid grid-cols-5 gap-3">
                                <div>
                                  <div className="text-xs text-slate-500">RT (min)</div>
                                  <div className="font-bold text-slate-900 text-sm">{compound.retentionTime.toFixed(1)}</div>
                                </div>
                                <div className="col-span-2">
                                  <div className="text-xs text-slate-500">Compound</div>
                                  <div className="font-bold text-slate-900 text-sm">{compound.compound}</div>
                                  <div className="text-xs text-slate-600 italic mt-0.5">{compound.odour}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-slate-500">NIST %</div>
                                  <div className="font-bold text-slate-900 text-sm">{compound.nistProbability}%</div>
                                </div>
                                <div>
                                  <div className="text-xs text-slate-500">Odour Intensity</div>
                                  <div className={`font-bold text-sm ${isDefect ? "text-rose-600" : "text-slate-900"}`}>
                                    {compound.odourIntensity.toFixed(1)}/5
                                  </div>
                                </div>
                              </div>
                              {compound.concentration && (
                                <div className="mt-2 flex items-center justify-between">
                                  <span className={`text-sm font-bold ${isDefect ? "text-rose-600" : "text-slate-700"}`}>
                                    {compound.concentration.toFixed(1)} ppm
                                  </span>
                                  {compound.threshold && (
                                    <span className="text-xs text-slate-500">
                                      threshold: {compound.threshold.toFixed(1)} ppm
                                    </span>
                                  )}
                                </div>
                              )}
                              {isDefect && (
                                <Badge className="mt-2 bg-rose-600 text-white text-xs">⚠ DEFECT (odour intensity ≥3)</Badge>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-600">No aroma compounds detected above threshold</p>
                  )}
                </CardContent>
              </Card>

              {/* Summary Stats */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-purple-600">{selectedData.taste.saltiness.toFixed(1)}</div>
                    <div className="text-sm text-slate-600 mt-1">Saltiness</div>
                    <div className="text-xs text-slate-500">TS-5000Z (0-10)</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-blue-600">{selectedData.composition.fat.toFixed(1)}%</div>
                    <div className="text-sm text-slate-600 mt-1">Fat Content</div>
                    <div className="text-xs text-slate-500">Gerber-van Gulik</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-orange-600">{selectedData.hedonic.overall.toFixed(1)}/9</div>
                    <div className="text-sm text-slate-600 mt-1">Hedonic Overall</div>
                    <div className="text-xs text-slate-500">9-point scale</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className={`text-2xl font-bold ${hasOffNotes ? "text-rose-600" : "text-emerald-600"}`}>
                      {hasOffNotes ? "FAIL" : "PASS"}
                    </div>
                    <div className="text-sm text-slate-600 mt-1">GC-O Off-Notes</div>
                    <div className="text-xs text-slate-500">Intensity ≥3</div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
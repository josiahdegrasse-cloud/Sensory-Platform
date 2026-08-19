export interface MultiSampleDataPoint {
  sampleCode: string;
  cataAttributes: string[];
  intensityRatings: Record<string, number>;
  hedonicScores: Partial<{ overall: number; [key: string]: number }>;
  emotionalProfile: Record<string, number>;
}

export interface MultiSampleSessionLike {
  id: string;
  userId: string;
  productId: string;
  differentSample: string;
  ranking: string[];
  samples: MultiSampleDataPoint[];
}

export interface MultiSampleDifferenceRow {
  sampleCode: string;
  count: number;
  share: number;
}

export interface MultiSampleRankingRow {
  sampleCode: string;
  firstPlaceCount: number;
  firstPlaceShare: number;
  averageRank: number | null;
  rankCounts: number[];
  totalRankings: number;
}

export interface MultiSampleHedonicRow {
  sampleCode: string;
  averageOverall: number;
  count: number;
}

export interface MultiSampleAttributeDriver {
  sampleCode: string;
  attribute: string;
  count: number;
  share: number;
}

export interface MultiSampleDecisionSummary {
  responseCount: number;
  completedPanelistCount: number;
  evidenceTone: 'empty' | 'limited' | 'ready';
  agreementState: 'empty' | 'directional' | 'aligned' | 'mixed';
  evidenceLabel: string;
  differenceSignal: string;
  preferenceSignal: string;
  driverSignal: string;
  nextAction: string;
  recommendedAction: string;
  differenceLeader: string | null;
  preferenceLeader: string | null;
  likingLeader: string | null;
  preferenceAgreement: boolean;
}

export interface MultiSampleAnalysisResult {
  sampleCodes: string[];
  responseCount: number;
  completedPanelistCount: number;
  minimumResponses: number;
  summary: MultiSampleDecisionSummary;
  differenceRows: MultiSampleDifferenceRow[];
  rankingRows: MultiSampleRankingRow[];
  hedonicRows: MultiSampleHedonicRow[];
  attributeDrivers: MultiSampleAttributeDriver[];
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

function uniqueSampleCodes(sessions: MultiSampleSessionLike[]) {
  const codes = new Set<string>();
  sessions.forEach(session => {
    session.samples.forEach(sample => {
      if (sample.sampleCode) codes.add(sample.sampleCode);
    });
    session.ranking.forEach(code => {
      if (code) codes.add(code);
    });
    if (session.differentSample) codes.add(session.differentSample);
  });
  return [...codes].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function evidenceTone(responseCount: number, minimumResponses: number): MultiSampleDecisionSummary['evidenceTone'] {
  if (responseCount === 0) return 'empty';
  return responseCount < minimumResponses ? 'limited' : 'ready';
}

function buildDifferenceRows(sessions: MultiSampleSessionLike[], sampleCodes: string[]): MultiSampleDifferenceRow[] {
  const counts = new Map(sampleCodes.map(code => [code, 0]));
  sessions.forEach(session => {
    if (!session.differentSample) return;
    counts.set(session.differentSample, (counts.get(session.differentSample) ?? 0) + 1);
  });
  return [...counts.entries()]
    .map(([sampleCode, count]) => ({
      sampleCode,
      count,
      share: sessions.length > 0 ? count / sessions.length : 0,
    }))
    .sort((a, b) => b.share - a.share || a.sampleCode.localeCompare(b.sampleCode, undefined, { numeric: true }));
}

function buildRankingRows(sessions: MultiSampleSessionLike[], sampleCodes: string[]): MultiSampleRankingRow[] {
  return sampleCodes.map(sampleCode => {
    const positions: number[] = [];
    sessions.forEach(session => {
      const index = session.ranking.indexOf(sampleCode);
      if (index >= 0) positions.push(index + 1);
    });
    const maxRank = Math.max(sampleCodes.length, ...sessions.map(session => session.ranking.length));
    const rankCounts = Array.from({ length: maxRank }, (_, index) =>
      positions.filter(position => position === index + 1).length
    );
    const firstPlaceCount = rankCounts[0] ?? 0;
    return {
      sampleCode,
      firstPlaceCount,
      firstPlaceShare: positions.length > 0 ? firstPlaceCount / positions.length : 0,
      averageRank: positions.length > 0
        ? positions.reduce((sum, position) => sum + position, 0) / positions.length
        : null,
      rankCounts,
      totalRankings: positions.length,
    };
  }).sort((a, b) => {
    if (a.averageRank === null && b.averageRank === null) return a.sampleCode.localeCompare(b.sampleCode, undefined, { numeric: true });
    if (a.averageRank === null) return 1;
    if (b.averageRank === null) return -1;
    return a.averageRank - b.averageRank || b.firstPlaceShare - a.firstPlaceShare;
  });
}

function buildHedonicRows(sessions: MultiSampleSessionLike[], sampleCodes: string[]): MultiSampleHedonicRow[] {
  return sampleCodes.map(sampleCode => {
    const values = sessions.flatMap(session =>
      session.samples
        .filter(sample => sample.sampleCode === sampleCode)
        .map(sample => Number(sample.hedonicScores.overall))
        .filter(Number.isFinite)
    );
    return {
      sampleCode,
      averageOverall: values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0,
      count: values.length,
    };
  }).sort((a, b) => b.averageOverall - a.averageOverall || a.sampleCode.localeCompare(b.sampleCode, undefined, { numeric: true }));
}

function buildAttributeDrivers(sessions: MultiSampleSessionLike[]): MultiSampleAttributeDriver[] {
  const counts = new Map<string, Map<string, number>>();
  const sampleCounts = new Map<string, number>();
  sessions.forEach(session => {
    session.samples.forEach(sample => {
      if (!sample.sampleCode) return;
      sampleCounts.set(sample.sampleCode, (sampleCounts.get(sample.sampleCode) ?? 0) + 1);
      if (!counts.has(sample.sampleCode)) counts.set(sample.sampleCode, new Map());
      const sampleCountsForCode = counts.get(sample.sampleCode)!;
      sample.cataAttributes.forEach(attribute => {
        sampleCountsForCode.set(attribute, (sampleCountsForCode.get(attribute) ?? 0) + 1);
      });
    });
  });

  return [...counts.entries()].flatMap(([sampleCode, attributeCounts]) => {
    const n = sampleCounts.get(sampleCode) ?? 0;
    return [...attributeCounts.entries()]
      .map(([attribute, count]) => ({
        sampleCode,
        attribute,
        count,
        share: n > 0 ? count / n : 0,
      }))
      .sort((a, b) => b.share - a.share || a.attribute.localeCompare(b.attribute))
      .slice(0, 3);
  });
}

function buildSummary(input: {
  responseCount: number;
  completedPanelistCount: number;
  minimumResponses: number;
  differenceRows: MultiSampleDifferenceRow[];
  rankingRows: MultiSampleRankingRow[];
  hedonicRows: MultiSampleHedonicRow[];
  attributeDrivers: MultiSampleAttributeDriver[];
}): MultiSampleDecisionSummary {
  const tone = evidenceTone(input.responseCount, input.minimumResponses);
  const differenceLeader = input.differenceRows[0] ?? null;
  const likingLeader = input.hedonicRows[0] ?? null;
  const hasDifferenceConsensus = Boolean(differenceLeader && differenceLeader.share >= 0.5);
  const preferenceAgreement = hasDifferenceConsensus;
  const topDriver = likingLeader
    ? input.attributeDrivers.find(driver => driver.sampleCode === likingLeader.sampleCode)
    : undefined;

  if (tone === 'empty') {
    return {
      responseCount: 0,
      completedPanelistCount: 0,
      evidenceTone: tone,
      agreementState: 'empty',
      evidenceLabel: 'No evidence yet',
      differenceSignal: 'No panelists have completed this study yet.',
      preferenceSignal: 'Preference cannot be interpreted until responses are collected.',
      driverSignal: 'Attribute drivers will appear after sample evaluations are submitted.',
      nextAction: 'Field the study with assigned panelists.',
      recommendedAction: 'Field the study with assigned panelists.',
      differenceLeader: null,
      preferenceLeader: null,
      likingLeader: null,
      preferenceAgreement: false,
    };
  }

  const evidenceLabel = tone === 'limited'
    ? `${input.responseCount}/${input.minimumResponses} responses - directional`
    : `${input.responseCount} responses - ready for review`;
  const differenceSignal = differenceLeader && differenceLeader.share >= 0.5
    ? `${differenceLeader.sampleCode} is most often identified as different (${pct(differenceLeader.share)} of responses).`
    : 'No single sample has a clear difference consensus.';
  const preferenceSignal = likingLeader
    ? `${likingLeader.sampleCode} has the highest average liking (${likingLeader.averageOverall.toFixed(1)}/9). Use this as diagnostic context, not the triangle-test answer.`
    : 'Liking evidence is incomplete.';
  const driverSignal = topDriver
    ? `${topDriver.attribute} is the leading descriptor for ${topDriver.sampleCode} (${pct(topDriver.share)} selection rate).`
    : 'No attribute driver has emerged yet.';
  const agreementState: MultiSampleDecisionSummary['agreementState'] = tone === 'limited'
    ? 'directional'
    : preferenceAgreement
      ? 'aligned'
      : 'mixed';
  const recommendedAction = tone === 'limited'
    ? 'Keep collecting responses before naming a winner or making external claims.'
    : hasDifferenceConsensus
      ? 'Compare the panel odd-sample consensus with the intended different formulation before moving to the next project gate.'
      : 'Keep fielding or repeat the triangle test before concluding the samples are perceptibly different.';

  return {
    responseCount: input.responseCount,
    completedPanelistCount: input.completedPanelistCount,
    evidenceTone: tone,
    agreementState,
    evidenceLabel,
    differenceSignal,
    preferenceSignal,
    driverSignal,
    nextAction: recommendedAction,
    recommendedAction,
    differenceLeader: differenceLeader?.sampleCode ?? null,
    preferenceLeader: likingLeader?.sampleCode ?? null,
    likingLeader: likingLeader?.sampleCode ?? null,
    preferenceAgreement,
  };
}

export function analyzeMultiSampleStudy(
  sessions: MultiSampleSessionLike[],
  minimumResponses = 12,
): MultiSampleAnalysisResult {
  const sampleCodes = uniqueSampleCodes(sessions);
  const differenceRows = buildDifferenceRows(sessions, sampleCodes);
  const rankingRows = buildRankingRows(sessions, sampleCodes);
  const hedonicRows = buildHedonicRows(sessions, sampleCodes);
  const attributeDrivers = buildAttributeDrivers(sessions);
  const completedPanelistCount = new Set(sessions.map(session => session.userId).filter(Boolean)).size;
  const summary = buildSummary({
    responseCount: sessions.length,
    completedPanelistCount,
    minimumResponses,
    differenceRows,
    rankingRows,
    hedonicRows,
    attributeDrivers,
  });

  return {
    sampleCodes,
    responseCount: sessions.length,
    completedPanelistCount,
    minimumResponses,
    summary,
    differenceRows,
    rankingRows,
    hedonicRows,
    attributeDrivers,
  };
}

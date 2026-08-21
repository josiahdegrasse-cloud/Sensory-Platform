import type { Product, QuestionnaireResponse } from '../data/survey-domain';
import type { ReportDataSheet, ReportExportCell } from '../lib/commercialization-data-export';

function textList(values: string[] | undefined) {
  return (values ?? []).filter(Boolean).join('; ');
}

function rounded(value: number) {
  return Number(value.toFixed(4));
}

function numericValues(values: Array<number | null | undefined>) {
  return values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
}

export function meanAndSampleStandardDeviation(values: Array<number | null | undefined>) {
  const observations = numericValues(values);
  if (observations.length === 0) return { n: 0, mean: null, standardDeviation: null };
  const mean = observations.reduce((total, value) => total + value, 0) / observations.length;
  if (observations.length === 1) {
    return { n: 1, mean: rounded(mean), standardDeviation: null };
  }
  const variance = observations.reduce((total, value) => total + ((value - mean) ** 2), 0) / (observations.length - 1);
  return { n: observations.length, mean: rounded(mean), standardDeviation: rounded(Math.sqrt(variance)) };
}

export function filterPanelResponsesByProductIds(
  responses: QuestionnaireResponse[],
  productIds: ReadonlySet<string>,
) {
  return responses.filter(response => productIds.has(response.productId));
}

function participantCodes(responses: QuestionnaireResponse[]) {
  const userIds = [...new Set(responses.map(response => response.userId))].sort();
  return new Map(userIds.map((userId, index) => [userId, `Participant ${String(index + 1).padStart(3, '0')}`]));
}

function rawDataSheet(products: Product[], responses: QuestionnaireResponse[]): ReportDataSheet {
  const productsById = new Map(products.map(product => [product.id, product]));
  const codes = participantCodes(responses);
  const cataKeys = [...new Set(responses.flatMap(response => response.cataAttributes))].sort();
  const intensityKeys = [...new Set(responses.flatMap(response => Object.keys(response.intensityRatings)))].sort();
  const hedonicKeys = [...new Set(responses.flatMap(response => Object.keys(response.hedonicScores)))].sort();
  const emotionKeys = [...new Set(responses.flatMap(response => Object.keys(response.emotionalProfile)))].sort();
  const fixedColumns = [
    'Response ID', 'Participant code', 'Product ID', 'Sample ID', 'Product name', 'Category',
    'Submitted', 'Run', 'Session type', 'Sample code', 'CATA descriptors', 'Comments',
    'Different sample', 'Ranking', 'Presentation order',
  ];
  const columns = [
    ...fixedColumns,
    ...cataKeys.map(key => `CATA · ${key}`),
    ...intensityKeys.map(key => `Intensity · ${key}`),
    ...hedonicKeys.map(key => `Hedonic · ${key}`),
    ...emotionKeys.map(key => `Emotion · ${key}`),
  ];
  const rows = responses.map(response => {
    const product = productsById.get(response.productId);
    const row: Record<string, ReportExportCell> = {
      'Response ID': response.id,
      'Participant code': codes.get(response.userId) ?? '',
      'Product ID': response.productId,
      'Sample ID': product?.sourceSampleId ?? '',
      'Product name': product?.name ?? response.productId,
      Category: product?.category ?? '',
      Submitted: response.timestamp,
      Run: response.runNumber,
      'Session type': response.sessionType ?? '',
      'Sample code': response.sampleCode ?? '',
      'CATA descriptors': textList(response.cataAttributes),
      Comments: response.comments ?? '',
      'Different sample': response.differentSample ?? '',
      Ranking: textList(response.ranking),
      'Presentation order': textList(response.presentationOrder),
    };
    cataKeys.forEach(key => { row[`CATA · ${key}`] = response.cataAttributes.includes(key) ? 1 : 0; });
    intensityKeys.forEach(key => { row[`Intensity · ${key}`] = response.intensityRatings[key] ?? null; });
    hedonicKeys.forEach(key => { row[`Hedonic · ${key}`] = response.hedonicScores[key as keyof QuestionnaireResponse['hedonicScores']] ?? null; });
    emotionKeys.forEach(key => { row[`Emotion · ${key}`] = response.emotionalProfile[key] ?? null; });
    return row;
  });
  return {
    key: 'food-panel-responses',
    name: 'Raw Data',
    description: 'One de-identified row per panelist response. CATA variables are encoded as 1 selected and 0 not selected.',
    columns,
    rows,
  };
}

function summaryStatisticsSheet(products: Product[], responses: QuestionnaireResponse[]): ReportDataSheet {
  const productsById = new Map(products.map(product => [product.id, product]));
  const grouped = new Map<string, QuestionnaireResponse[]>();
  responses.forEach(response => {
    const key = JSON.stringify([response.productId, response.sampleCode ?? '']);
    const group = grouped.get(key) ?? [];
    group.push(response);
    grouped.set(key, group);
  });

  const rows: Array<Record<string, ReportExportCell>> = [];
  grouped.forEach(groupResponses => {
    const first = groupResponses[0];
    if (!first) return;
    const product = productsById.get(first.productId);
    const base = {
      'Product ID': first.productId,
      'Sample ID': product?.sourceSampleId ?? '',
      'Product name': product?.name ?? first.productId,
      Category: product?.category ?? '',
      'Sample code': first.sampleCode ?? '',
    };
    const addMetric = (resultGroup: string, attribute: string, values: Array<number | null | undefined>, unit: string) => {
      const statistics = meanAndSampleStandardDeviation(values);
      rows.push({
        ...base,
        'Result group': resultGroup,
        Attribute: attribute,
        N: statistics.n,
        Mean: statistics.mean,
        'Standard deviation': statistics.standardDeviation,
        'Scale or unit': unit,
        'SD method': 'Sample SD (n−1)',
      });
    };

    const cataKeys = [...new Set(groupResponses.flatMap(response => response.cataAttributes))].sort();
    cataKeys.forEach(attribute => addMetric(
      'CATA',
      attribute,
      groupResponses.map(response => response.cataAttributes.includes(attribute) ? 1 : 0),
      'Selection proportion (0–1)',
    ));
    const intensityKeys = [...new Set(groupResponses.flatMap(response => Object.keys(response.intensityRatings)))].sort();
    intensityKeys.forEach(attribute => addMetric(
      'Intensity', attribute, groupResponses.map(response => response.intensityRatings[attribute]), '1–9',
    ));
    const hedonicKeys = [...new Set(groupResponses.flatMap(response => Object.keys(response.hedonicScores)))].sort();
    hedonicKeys.forEach(attribute => addMetric(
      'Hedonic', attribute,
      groupResponses.map(response => response.hedonicScores[attribute as keyof QuestionnaireResponse['hedonicScores']]),
      '1–9',
    ));
    const emotionKeys = [...new Set(groupResponses.flatMap(response => Object.keys(response.emotionalProfile)))].sort();
    emotionKeys.forEach(attribute => addMetric(
      'Emotion', attribute, groupResponses.map(response => response.emotionalProfile[attribute]), '1–9',
    ));
  });

  return {
    key: 'food-panel-summary-statistics',
    name: 'Means and SD',
    description: 'Means and sample standard deviations grouped by product and sample code.',
    columns: [
      'Product ID', 'Sample ID', 'Product name', 'Category', 'Sample code', 'Result group',
      'Attribute', 'N', 'Mean', 'Standard deviation', 'Scale or unit', 'SD method',
    ],
    rows,
  };
}

export function buildFoodPanelWorkbookSheets(
  products: Product[],
  responses: QuestionnaireResponse[],
): ReportDataSheet[] {
  return [rawDataSheet(products, responses), summaryStatisticsSheet(products, responses)];
}

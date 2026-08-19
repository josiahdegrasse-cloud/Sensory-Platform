import type { ConceptResponse, ConceptTest } from '../lib/database';
import type { LiveAggregation } from '../lib/use-survey-data';

type CsvValue = string | number | boolean | null | undefined;
export type InsightsExportRows = CsvValue[][];

function protectSpreadsheetCell(value: CsvValue) {
  let text = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return text;
}

export function serializeInsightsCsv(rows: InsightsExportRows) {
  return rows
    .map(row => row
      .map(value => `"${protectSpreadsheetCell(value).replace(/"/g, '""')}"`)
      .join(','))
    .join('\r\n');
}

export function filterPanelResultsByProductIds(
  aggregations: LiveAggregation[],
  productIds: ReadonlySet<string>,
) {
  return aggregations.filter(aggregation => productIds.has(aggregation.productId));
}

function rounded(value: number) {
  return Number(value.toFixed(4));
}

export function buildFoodPanelResultsRows(aggregations: LiveAggregation[]): InsightsExportRows {
  const rows: InsightsExportRows = [[
    'Product ID',
    'Sample ID',
    'Product name',
    'Category',
    'Responses',
    'Result group',
    'Attribute',
    'Statistic',
    'Value',
    'Scale or unit',
  ]];

  aggregations.forEach(aggregation => {
    const base: CsvValue[] = [
      aggregation.productId,
      aggregation.sourceSampleId ?? '',
      aggregation.productName,
      aggregation.category ?? '',
      aggregation.n,
    ];

    Object.entries(aggregation.cata).forEach(([attribute, count]) => {
      rows.push([...base, 'CATA', attribute, 'Selection count', count, 'Count']);
      rows.push([...base, 'CATA', attribute, 'Selection percentage', aggregation.n ? rounded((count / aggregation.n) * 100) : 0, 'Percent']);
    });
    Object.entries(aggregation.intensity).forEach(([attribute, mean]) => {
      rows.push([...base, 'Intensity', attribute, 'Mean', rounded(mean), '1–9']);
    });
    Object.entries(aggregation.hedonic).forEach(([attribute, mean]) => {
      rows.push([...base, 'Hedonic', attribute, 'Mean', rounded(mean), '1–9']);
      rows.push([...base, 'Hedonic', attribute, 'Standard deviation', aggregation.hedonicSD[attribute] == null ? '' : rounded(aggregation.hedonicSD[attribute]), '1–9']);
    });
    rows.push([...base, 'Emotion', 'Positive', 'Mean', rounded(aggregation.emotions.positive), 'Index']);
    rows.push([...base, 'Emotion', 'Negative', 'Mean', rounded(aggregation.emotions.negative), 'Index']);
  });

  return rows;
}

function answerText(answer: string | number | string[] | undefined) {
  return Array.isArray(answer) ? answer.join(' | ') : answer ?? '';
}

export function buildConceptTestingResultsRows(
  concepts: ConceptTest[],
  responses: ConceptResponse[],
): InsightsExportRows {
  const rows: InsightsExportRows = [[
    'Concept name',
    'Category',
    'Project',
    'Status',
    'Anonymous response',
    'Submitted at',
    'Question ID',
    'Question',
    'Question type',
    'Question category',
    'Answer',
  ]];
  const responsesByConcept = new Map<string, ConceptResponse[]>();

  responses.forEach(response => {
    const group = responsesByConcept.get(response.conceptTestId) ?? [];
    group.push(response);
    responsesByConcept.set(response.conceptTestId, group);
  });

  concepts.forEach(concept => {
    const conceptResponses = responsesByConcept.get(concept.id) ?? [];
    conceptResponses.forEach((response, responseIndex) => {
      const knownQuestionIds = new Set(concept.questions.map(question => question.id));
      const questions = [
        ...concept.questions,
        ...Object.keys(response.answers)
          .filter(questionId => !knownQuestionIds.has(questionId))
          .map(questionId => ({
            id: questionId,
            text: questionId,
            type: 'open_text' as const,
            category: 'Unmapped',
          })),
      ];

      questions.forEach(question => {
        rows.push([
          concept.name,
          concept.category,
          concept.projectName ?? '',
          concept.status,
          `Panelist ${responseIndex + 1}`,
          response.createdAt,
          question.id,
          question.text,
          question.type,
          question.category,
          answerText(response.answers[question.id]),
        ]);
      });
    });
  });

  return rows;
}

export function downloadInsightsCsv(rows: InsightsExportRows, filename: string) {
  const blob = new Blob([`\uFEFF${serializeInsightsCsv(rows)}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function exportFilename(scope: string, dataset: 'food-panel-results' | 'concept-testing-results', now = new Date()) {
  const safeScope = scope
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'project';
  return `${safeScope}-${dataset}-${now.toISOString().slice(0, 10)}.csv`;
}

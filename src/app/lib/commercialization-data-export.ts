import type { Product, QuestionnaireResponse } from '../data/survey-domain';
import type {
  CommercializationReportRecord,
  ConceptResponse,
  ConceptTest,
  DecisionRecord,
  InstrumentalDataset,
  PanelistInfo,
} from './database';
import type { CommercializationReportSnapshot } from './commercialization-report';
import type { EvidenceBundle } from './report-evidence-types';
import type { FormulationVersion } from './formulation-profile';

export type ReportDataSectionKey =
  | 'report-summary'
  | 'report-narrative'
  | 'product-records'
  | 'decision-evidence'
  | 'panelist-demographics'
  | 'food-panel-responses'
  | 'food-panel-summary-statistics'
  | 'concept-test'
  | 'concept-results'
  | 'concept-responses'
  | 'e-tongue'
  | 'gc-ms'
  | 'composition'
  | 'formulation'
  | 'evidence-register'
  | 'commercial-plan';

export type ReportDataSectionGroup = 'Report' | 'Consumers' | 'Food & science' | 'Governance';

export interface ReportDataSectionDefinition {
  key: ReportDataSectionKey;
  group: ReportDataSectionGroup;
  label: string;
  description: string;
  sheetName: string;
}

export const REPORT_DATA_SECTION_DEFINITIONS: ReportDataSectionDefinition[] = [
  { key: 'report-summary', group: 'Report', label: 'Report summary', description: 'Version, status, product, concept, and release metadata.', sheetName: 'Report Summary' },
  { key: 'report-narrative', group: 'Report', label: 'Report narrative', description: 'The saved client-facing report copy.', sheetName: 'Report Narrative' },
  { key: 'panelist-demographics', group: 'Consumers', label: 'Panelist demographics', description: 'De-identified demographic profiles for report participants.', sheetName: 'Panelist Demographics' },
  { key: 'food-panel-responses', group: 'Consumers', label: 'Food panel responses', description: 'Raw sensory, hedonic, emotional, CATA, and comment results.', sheetName: 'Food Panel Responses' },
  { key: 'concept-test', group: 'Consumers', label: 'Concept test design', description: 'Concept positioning, panel setup, and question wording.', sheetName: 'Concept Test' },
  { key: 'concept-results', group: 'Consumers', label: 'Concept results summary', description: 'Aggregated scores, selections, purchase intent, and comments.', sheetName: 'Concept Results' },
  { key: 'concept-responses', group: 'Consumers', label: 'Concept responses', description: 'One de-identified row per consumer response.', sheetName: 'Concept Responses' },
  { key: 'product-records', group: 'Food & science', label: 'Product records', description: 'Linked sensory-study and sample metadata.', sheetName: 'Product Records' },
  { key: 'e-tongue', group: 'Food & science', label: 'Instrumental parameters', description: 'All imported numeric parameters with units, replicate counts, variability, and ranges.', sheetName: 'Instrumental Parameters' },
  { key: 'gc-ms', group: 'Food & science', label: 'GC-MS compounds', description: 'Volatile compounds, concentrations, aromas, and thresholds.', sheetName: 'GC-MS' },
  { key: 'composition', group: 'Food & science', label: 'Composition data', description: 'Protein, fat, moisture, pH, salt, and calcium.', sheetName: 'Composition' },
  { key: 'formulation', group: 'Food & science', label: 'Formulation & ingredients', description: 'Saved formulation version and reviewed ingredient records.', sheetName: 'Formulation' },
  { key: 'decision-evidence', group: 'Governance', label: 'Decision evidence', description: 'GO decision, dimensions, gates, and prescribed actions.', sheetName: 'Decision Evidence' },
  { key: 'evidence-register', group: 'Governance', label: 'Evidence register', description: 'Evidence provenance, missing-data issues, and quality warnings.', sheetName: 'Evidence Register' },
  { key: 'commercial-plan', group: 'Governance', label: 'Commercial action plan', description: 'Owners, priorities, dependencies, and passing criteria.', sheetName: 'Commercial Plan' },
];

export type ReportExportCell = string | number | boolean | Date | null;

export interface ReportDataSheet {
  key: ReportDataSectionKey;
  name: string;
  description: string;
  columns: string[];
  rows: Array<Record<string, ReportExportCell>>;
}

export interface CommercializationDataExportInput {
  report: CommercializationReportRecord;
  snapshot: CommercializationReportSnapshot;
  decision: DecisionRecord;
  concept: ConceptTest | null;
  conceptResponses: ConceptResponse[];
  products: Product[];
  foodPanelResponses: QuestionnaireResponse[];
  panelists: PanelistInfo[];
  instrumentalDataset?: InstrumentalDataset;
  formulationVersions: FormulationVersion[];
  evidenceBundle: EvidenceBundle | null;
  organizationName: string;
  workspaceName: string;
  anonymizePanelists: boolean;
}

const definitionByKey = new Map(REPORT_DATA_SECTION_DEFINITIONS.map(item => [item.key, item]));

function sheet(
  key: ReportDataSectionKey,
  columns: string[],
  rows: Array<Record<string, ReportExportCell>>,
): ReportDataSheet {
  const definition = definitionByKey.get(key)!;
  return { key, name: definition.sheetName, description: definition.description, columns, rows };
}

function textList(values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value)).join('; ');
}

function humanize(value: string | null | undefined) {
  if (!value) return '';
  return value.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function participantCodes(input: CommercializationDataExportInput) {
  const ids = [...new Set([
    ...input.foodPanelResponses.map(response => response.userId),
    ...input.conceptResponses.map(response => response.userId),
  ])].sort();
  const panelistById = new Map(input.panelists.map(panelist => [panelist.id, panelist]));
  return new Map(ids.map((id, index) => {
    const registeredCode = panelistById.get(id)?.panelistId;
    const fallback = `Participant ${String(index + 1).padStart(3, '0')}`;
    return [id, input.anonymizePanelists ? fallback : registeredCode || fallback];
  }));
}

function reportSummary(input: CommercializationDataExportInput) {
  const rows: Array<Record<string, ReportExportCell>> = [
    { Field: 'Organization', Value: input.organizationName },
    { Field: 'Workspace', Value: input.workspaceName },
    { Field: 'Report title', Value: input.report.title },
    { Field: 'Report version', Value: input.report.version },
    { Field: 'Report status', Value: humanize(input.report.status) },
    { Field: 'Generated at', Value: input.snapshot.generatedAt },
    { Field: 'Approved at', Value: input.report.approvedAt ?? '' },
    { Field: 'Product', Value: input.snapshot.product.sampleName },
    { Field: 'Sample ID', Value: input.snapshot.product.sampleId },
    { Field: 'Food type', Value: input.snapshot.product.foodType },
    { Field: 'Decision', Value: input.snapshot.decision.outcome },
    { Field: 'ISSF score', Value: input.snapshot.decision.issfScore },
    { Field: 'Decision confidence', Value: input.snapshot.decision.confidence },
    { Field: 'Concept', Value: input.snapshot.concept.name },
    { Field: 'Target market', Value: input.snapshot.concept.targetMarket },
    { Field: 'Concept response count', Value: input.snapshot.evidence.responseCount },
    { Field: 'Export privacy', Value: input.anonymizePanelists ? 'Participant identities anonymized' : 'Registered panelist codes included; direct contact fields excluded' },
  ];
  return sheet('report-summary', ['Field', 'Value'], rows);
}

function reportNarrative(input: CommercializationDataExportInput) {
  const labels: Record<keyof CommercializationReportSnapshot['narrative'], string> = {
    executiveSummary: 'Executive summary',
    whyLiked: 'Why consumers liked it',
    packagingRationale: 'Packaging rationale',
    launchRecommendation: 'Launch recommendation',
    claimCaution: 'Claims caution',
  };
  return sheet('report-narrative', ['Section', 'Narrative'], Object.entries(input.snapshot.narrative).map(([key, value]) => ({
    Section: labels[key as keyof CommercializationReportSnapshot['narrative']],
    Narrative: value,
  })));
}

function productRecords(input: CommercializationDataExportInput) {
  return sheet('product-records', [
    'Product ID', 'Product', 'Category', 'Status', 'Created', 'Project ID', 'Instrumental sample ID',
    'Source sample ID', 'Import batch ID', 'Blind code', 'Multi-sample', 'Calibration', 'Assigned panelists', 'Survey sections',
  ], input.products.map(product => ({
    'Product ID': product.id,
    Product: product.name,
    Category: product.category,
    Status: humanize(product.status),
    Created: product.createdDate,
    'Project ID': product.projectId ?? '',
    'Instrumental sample ID': product.instrumentalSampleId ?? '',
    'Source sample ID': product.sourceSampleId ?? '',
    'Import batch ID': product.sourceImportBatchId ?? '',
    'Blind code': product.blindCode ?? '',
    'Multi-sample': Boolean(product.isMultiSample),
    Calibration: Boolean(product.isCalibration),
    'Assigned panelists': product.assignedPanelistIds?.length ?? 0,
    'Survey sections': textList(product.surveySections ?? []),
  })));
}

function decisionEvidence(input: CommercializationDataExportInput) {
  const rows: Array<Record<string, ReportExportCell>> = [
    { 'Record type': 'Decision', Measure: 'Outcome', Value: input.decision.decision, Status: 'Confirmed', Detail: input.decision.note },
    { 'Record type': 'Decision', Measure: 'ISSF score', Value: input.decision.issfScore, Status: '', Detail: input.snapshot.decision.recommendation },
    { 'Record type': 'Decision', Measure: 'Confidence', Value: input.decision.confidence, Status: '', Detail: '' },
    { 'Record type': 'Decision', Measure: 'Method version', Value: input.decision.methodVersion, Status: '', Detail: input.decision.decisionFingerprint },
    ...Object.entries(input.snapshot.decision.dimensions).map(([measure, value]) => ({
      'Record type': 'Dimension', Measure: humanize(measure), Value: value, Status: '', Detail: '',
    })),
    ...(input.snapshot.decision.gates ?? []).map(gate => ({
      'Record type': 'Gate', Measure: gate.label, Value: gate.impact, Status: humanize(gate.status), Detail: gate.detail,
    })),
    ...input.snapshot.decision.prescriptions.map(item => ({
      'Record type': 'Action', Measure: item.target, Value: item.expectedLift, Status: `Priority ${item.priority}`, Detail: item.action,
    })),
  ];
  return sheet('decision-evidence', ['Record type', 'Measure', 'Value', 'Status', 'Detail'], rows);
}

function demographics(input: CommercializationDataExportInput, codes: Map<string, string>) {
  const participantIds = new Set(codes.keys());
  const rows = input.panelists
    .filter(panelist => participantIds.has(panelist.id))
    .sort((left, right) => (codes.get(left.id) ?? '').localeCompare(codes.get(right.id) ?? ''))
    .map(panelist => ({
      'Participant code': codes.get(panelist.id) ?? '',
      'Age band': panelist.ageBand ?? '',
      Gender: panelist.gender === 'self_describe' ? panelist.genderSelfDescription ?? 'Self-described' : humanize(panelist.gender),
      Nationality: panelist.nationalityCode ?? '',
      Ethnicity: humanize(panelist.ethnicity),
      'Household size': panelist.householdSizePreferNotToSay ? 'Prefer not to say' : panelist.householdSize,
      'Children in household': panelist.childrenInHousehold === null ? '' : panelist.childrenInHousehold,
      'Dietary pattern': panelist.dietaryPattern === 'other' ? panelist.dietaryOther ?? 'Other' : humanize(panelist.dietaryPattern),
      'Grocery role': humanize(panelist.groceryRole),
      'Category usage frequency': humanize(panelist.categoryUsageFrequency),
      'Smoker status': humanize(panelist.smokerStatus),
      'Weekly food spend': humanize(panelist.weeklyFoodSpend),
      'Occupation group': humanize(panelist.occupationGroup),
      'Annual income range': humanize(panelist.annualIncomeRange),
      'Training level': humanize(panelist.trainingLevel),
    }));
  return sheet('panelist-demographics', [
    'Participant code', 'Age band', 'Gender', 'Nationality', 'Ethnicity', 'Household size',
    'Children in household', 'Dietary pattern', 'Grocery role', 'Category usage frequency',
    'Smoker status', 'Weekly food spend', 'Occupation group', 'Annual income range', 'Training level',
  ], rows);
}

function foodResponses(input: CommercializationDataExportInput, codes: Map<string, string>) {
  const productsById = new Map(input.products.map(product => [product.id, product]));
  const intensityKeys = [...new Set(input.foodPanelResponses.flatMap(response => Object.keys(response.intensityRatings)))].sort();
  const hedonicKeys = [...new Set(input.foodPanelResponses.flatMap(response => Object.keys(response.hedonicScores)))].sort();
  const emotionKeys = [...new Set(input.foodPanelResponses.flatMap(response => Object.keys(response.emotionalProfile)))].sort();
  const fixed = ['Response ID', 'Participant code', 'Product', 'Submitted', 'Run', 'Session type', 'Sample code', 'CATA descriptors', 'Comments', 'Different sample', 'Ranking', 'Presentation order'];
  const dynamic = [
    ...intensityKeys.map(key => `Intensity · ${key}`),
    ...hedonicKeys.map(key => `Hedonic · ${key}`),
    ...emotionKeys.map(key => `Emotion · ${key}`),
  ];
  const rows = input.foodPanelResponses.map(response => {
    const row: Record<string, ReportExportCell> = {
      'Response ID': response.id,
      'Participant code': codes.get(response.userId) ?? '',
      Product: productsById.get(response.productId)?.name ?? response.productId,
      Submitted: response.timestamp,
      Run: response.runNumber,
      'Session type': response.sessionType ?? '',
      'Sample code': response.sampleCode ?? '',
      'CATA descriptors': textList(response.cataAttributes),
      Comments: response.comments ?? '',
      'Different sample': response.differentSample ?? '',
      Ranking: textList(response.ranking ?? []),
      'Presentation order': textList(response.presentationOrder ?? []),
    };
    intensityKeys.forEach(key => { row[`Intensity · ${key}`] = response.intensityRatings[key] ?? null; });
    hedonicKeys.forEach(key => { row[`Hedonic · ${key}`] = response.hedonicScores[key as keyof typeof response.hedonicScores] ?? null; });
    emotionKeys.forEach(key => { row[`Emotion · ${key}`] = response.emotionalProfile[key] ?? null; });
    return row;
  });
  return sheet('food-panel-responses', [...fixed, ...dynamic], rows);
}

function conceptTest(input: CommercializationDataExportInput) {
  if (!input.concept) return sheet('concept-test', ['Concept', 'Question'], []);
  const concept = input.concept;
  const questions = concept.questions.length ? concept.questions : [null];
  return sheet('concept-test', [
    'Concept', 'Description', 'Target market', 'Price point', 'Key benefits', 'Status', 'Panel size',
    'Assigned panelists', 'Created', 'Launched', 'Question ID', 'Question', 'Question type', 'Category', 'Required', 'Options',
  ], questions.map(question => ({
    Concept: concept.name,
    Description: concept.description,
    'Target market': concept.targetMarket,
    'Price point': concept.pricePoint,
    'Key benefits': concept.keyBenefits,
    Status: humanize(concept.status),
    'Panel size': concept.panelSize,
    'Assigned panelists': concept.assignedPanelistIds.length,
    Created: concept.createdAt,
    Launched: concept.launchedAt ?? '',
    'Question ID': question?.id ?? '',
    Question: question?.text ?? '',
    'Question type': question ? humanize(question.type) : '',
    Category: question?.category ?? '',
    Required: question?.required ?? false,
    Options: textList(question?.options ?? []),
  })));
}

function conceptResults(input: CommercializationDataExportInput) {
  const evidence = input.snapshot.evidence;
  const rows: Array<Record<string, ReportExportCell>> = [
    { Type: 'Response count', Item: 'Completed concept responses', Value: evidence.responseCount, Count: evidence.responseCount, Percentage: null },
    ...(evidence.purchaseIntent === null ? [] : [{ Type: 'Purchase intent', Item: 'Average purchase intent', Value: evidence.purchaseIntent, Count: evidence.responseCount, Percentage: null }]),
    ...evidence.scaleMetrics.map(metric => ({ Type: 'Scale', Item: metric.question, Value: metric.average, Count: metric.count, Percentage: null })),
    ...evidence.topSelections.map(item => ({ Type: 'Selection', Item: item.option, Value: item.count, Count: item.count, Percentage: item.percentage })),
    ...evidence.comments.map(comment => ({ Type: 'Comment', Item: comment, Value: '', Count: 1, Percentage: null })),
  ];
  return sheet('concept-results', ['Type', 'Item', 'Value', 'Count', 'Percentage'], rows);
}

function conceptResponses(input: CommercializationDataExportInput, codes: Map<string, string>) {
  const questions = input.concept?.questions ?? [];
  const questionColumns = questions.map((question, index) => `Q${index + 1} · ${question.text}`);
  const rows = input.conceptResponses.map(response => {
    const row: Record<string, ReportExportCell> = {
      'Response ID': response.id,
      'Participant code': codes.get(response.userId) ?? '',
      Submitted: response.createdAt,
    };
    questions.forEach((question, index) => {
      const answer = response.answers[question.id];
      row[questionColumns[index]] = Array.isArray(answer) ? textList(answer) : answer ?? '';
    });
    return row;
  });
  return sheet('concept-responses', ['Response ID', 'Participant code', 'Submitted', ...questionColumns], rows);
}

function targetInstrumentalSamples(input: CommercializationDataExportInput) {
  const candidates = input.instrumentalDataset?.eTongueData ?? [];
  return candidates.filter(sample =>
    sample.sampleId === input.snapshot.product.sampleId
    || (input.decision.instrumentalSampleId && sample.instrumentalSampleId === input.decision.instrumentalSampleId)
    || sample.sampleName?.trim().toLowerCase() === input.snapshot.product.sampleName.trim().toLowerCase(),
  );
}

function eTongue(input: CommercializationDataExportInput) {
  const rows: Array<Record<string, ReportExportCell>> = [];
  targetInstrumentalSamples(input).forEach(sample => {
    rows.push({
      'Sample ID': sample.sampleId, Sample: sample.sampleName ?? '', Category: sample.category ?? sample.type ?? '',
      Measurement: 'Sourness', Value: sample.sourness, Unit: '', 'Observation count': null, 'Standard deviation': null, Minimum: null, Maximum: null,
    });
    rows.push({ 'Sample ID': sample.sampleId, Sample: sample.sampleName ?? '', Category: sample.category ?? sample.type ?? '', Measurement: 'Bitterness', Value: sample.bitterness, Unit: '', 'Observation count': null, 'Standard deviation': null, Minimum: null, Maximum: null });
    rows.push({ 'Sample ID': sample.sampleId, Sample: sample.sampleName ?? '', Category: sample.category ?? sample.type ?? '', Measurement: 'Saltiness', Value: sample.saltiness, Unit: '', 'Observation count': null, 'Standard deviation': null, Minimum: null, Maximum: null });
    rows.push({ 'Sample ID': sample.sampleId, Sample: sample.sampleName ?? '', Category: sample.category ?? sample.type ?? '', Measurement: 'Umami', Value: sample.umami, Unit: '', 'Observation count': null, 'Standard deviation': null, Minimum: null, Maximum: null });
    rows.push({ 'Sample ID': sample.sampleId, Sample: sample.sampleName ?? '', Category: sample.category ?? sample.type ?? '', Measurement: 'Sweetness', Value: sample.sweetness, Unit: '', 'Observation count': null, 'Standard deviation': null, Minimum: null, Maximum: null });
    (sample.measurements ?? []).forEach(measurement => rows.push({
      'Sample ID': sample.sampleId,
      Sample: sample.sampleName ?? '',
      Category: sample.category ?? sample.type ?? '',
      Measurement: measurement.label,
      Value: measurement.mean,
      Unit: measurement.unit,
      'Observation count': measurement.observationCount,
      'Standard deviation': measurement.standardDeviation ?? null,
      Minimum: measurement.minimum ?? null,
      Maximum: measurement.maximum ?? null,
    }));
  });
  return sheet('e-tongue', ['Sample ID', 'Sample', 'Category', 'Measurement', 'Value', 'Unit', 'Observation count', 'Standard deviation', 'Minimum', 'Maximum'], rows);
}

function gcMs(input: CommercializationDataExportInput) {
  const sampleIds = new Set(targetInstrumentalSamples(input).map(sample => sample.sampleId));
  const rows = [...sampleIds].flatMap(sampleId => (input.instrumentalDataset?.gcmsData[sampleId] ?? []).map(compound => ({
    'Sample ID': sampleId,
    Compound: compound.name,
    Concentration: compound.concentration,
    Aroma: compound.aroma,
    Threshold: compound.threshold,
    'Above threshold': compound.threshold > 0 && compound.concentration >= compound.threshold,
  })));
  return sheet('gc-ms', ['Sample ID', 'Compound', 'Concentration', 'Aroma', 'Threshold', 'Above threshold'], rows);
}

function composition(input: CommercializationDataExportInput) {
  const sampleIds = new Set(targetInstrumentalSamples(input).map(sample => sample.sampleId));
  const rows = [...sampleIds].flatMap(sampleId => {
    const value = input.instrumentalDataset?.compositionData[sampleId];
    if (!value) return [];
    return [{
      'Sample ID': sampleId,
      Protein: value.protein,
      Fat: value.fat,
      Moisture: value.moisture,
      pH: value.pH,
      Salt: value.saltContent,
      'Calcium (mg)': value.calciumMg,
    }];
  });
  return sheet('composition', ['Sample ID', 'Protein', 'Fat', 'Moisture', 'pH', 'Salt', 'Calcium (mg)'], rows);
}

function formulation(input: CommercializationDataExportInput) {
  const requestedVersionId = input.report.formulationVersionId ?? input.snapshot.formulation?.versionId;
  const matching = input.formulationVersions.filter(version => requestedVersionId
    ? version.id === requestedVersionId
    : version.sampleId === input.snapshot.product.sampleId && version.isCurrent);
  const rows: Array<Record<string, ReportExportCell>> = [];
  matching.forEach(version => {
    if (version.ingredients.length === 0) {
      rows.push({
        'Version ID': version.id, Version: version.versionNumber, 'Review status': humanize(version.reviewStatus),
        'Exact statement': version.exactStatement, Position: null, Ingredient: '', 'Canonical name': '', 'Functional role': '',
        Percentage: null, Allergens: '', 'Dietary tags': '', Confidence: null, 'Ingredient review': '', Notes: '',
      });
      return;
    }
    version.ingredients.forEach(ingredient => rows.push({
      'Version ID': version.id,
      Version: version.versionNumber,
      'Review status': humanize(version.reviewStatus),
      'Exact statement': version.exactStatement,
      Position: ingredient.position,
      Ingredient: ingredient.suppliedName,
      'Canonical name': ingredient.canonicalName,
      'Functional role': ingredient.functionalRole,
      Percentage: ingredient.percentage,
      Allergens: textList(ingredient.allergenTags),
      'Dietary tags': textList(ingredient.dietaryTags),
      Confidence: ingredient.confidence,
      'Ingredient review': humanize(ingredient.reviewStatus),
      Notes: ingredient.notes,
    }));
  });
  if (rows.length === 0 && input.snapshot.formulation) {
    rows.push(...input.snapshot.formulation.reviewedIngredients.map((ingredient, index) => ({
      'Version ID': input.snapshot.formulation!.versionId,
      Version: input.snapshot.formulation!.versionNumber,
      'Review status': humanize(input.snapshot.formulation!.reviewStatus),
      'Exact statement': input.snapshot.formulation!.exactStatement ?? '',
      Position: index + 1,
      Ingredient: ingredient,
      'Canonical name': '',
      'Functional role': '',
      Percentage: null,
      Allergens: textList(input.snapshot.formulation!.verifiedAllergens),
      'Dietary tags': '',
      Confidence: null,
      'Ingredient review': 'Reviewed snapshot',
      Notes: textList(input.snapshot.formulation!.readinessGaps),
    })));
  }
  return sheet('formulation', [
    'Version ID', 'Version', 'Review status', 'Exact statement', 'Position', 'Ingredient', 'Canonical name',
    'Functional role', 'Percentage', 'Allergens', 'Dietary tags', 'Confidence', 'Ingredient review', 'Notes',
  ], rows);
}

function evidenceRegister(input: CommercializationDataExportInput) {
  const bundle = input.evidenceBundle;
  if (!bundle) return sheet('evidence-register', ['Record type', 'Title', 'Description'], []);
  const rows: Array<Record<string, ReportExportCell>> = [
    ...bundle.evidence.map(record => ({
      'Record type': humanize(record.evidenceType), Title: record.title, Description: record.description,
      Value: record.value ?? null, Unit: record.unit ?? '', Source: record.sourceType, 'Source ID': record.sourceId ?? '',
      Category: record.category ?? '', 'Sample ID': record.sampleId ?? '', Confidence: record.confidence, Critical: record.isCritical, Severity: '',
    })),
    ...bundle.missingData.map(record => ({
      'Record type': 'Missing data', Title: record.title, Description: record.description, Value: null, Unit: '', Source: '',
      'Source ID': '', Category: '', 'Sample ID': record.sampleId ?? '', Confidence: null, Critical: record.severity === 'critical', Severity: humanize(record.severity),
    })),
    ...bundle.qualityWarnings.map(record => ({
      'Record type': 'Quality warning', Title: record.title, Description: record.description, Value: null, Unit: '', Source: '',
      'Source ID': '', Category: '', 'Sample ID': record.sampleId ?? '', Confidence: null, Critical: record.severity === 'critical', Severity: humanize(record.severity),
    })),
  ];
  return sheet('evidence-register', ['Record type', 'Title', 'Description', 'Value', 'Unit', 'Source', 'Source ID', 'Category', 'Sample ID', 'Confidence', 'Critical', 'Severity'], rows);
}

function commercialPlan(input: CommercializationDataExportInput) {
  const rows = (input.evidenceBundle?.commercialProfile?.actionPlan ?? []).map(item => ({
    Workstream: item.workstream,
    Owner: item.owner,
    Team: item.team,
    Priority: humanize(item.priority),
    'Due date': item.dueDate ?? '',
    Action: item.action,
    'Completion evidence': item.completionEvidence,
    'Passing criteria': item.passingCriteria,
    Dependencies: textList(item.dependencies),
    'Next gate': item.nextGate,
  }));
  return sheet('commercial-plan', ['Workstream', 'Owner', 'Team', 'Priority', 'Due date', 'Action', 'Completion evidence', 'Passing criteria', 'Dependencies', 'Next gate'], rows);
}

export function buildCommercializationDataSheets(input: CommercializationDataExportInput): ReportDataSheet[] {
  const codes = participantCodes(input);
  return [
    reportSummary(input),
    reportNarrative(input),
    productRecords(input),
    decisionEvidence(input),
    demographics(input, codes),
    foodResponses(input, codes),
    conceptTest(input),
    conceptResults(input),
    conceptResponses(input, codes),
    eTongue(input),
    gcMs(input),
    composition(input),
    formulation(input),
    evidenceRegister(input),
    commercialPlan(input),
  ];
}

function safeSpreadsheetText(value: ReportExportCell): ReportExportCell {
  if (typeof value !== 'string') return value;
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function safeFilename(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'commercialization-report';
}

export async function downloadCommercializationDataWorkbook(input: {
  sheets: ReportDataSheet[];
  organizationName: string;
  reportTitle: string;
  generatedAt?: Date;
}) {
  if (input.sheets.length === 0) throw new Error('Select at least one data sheet to export.');
  const excel = (await import('exceljs')).default;
  const workbook = new excel.Workbook();
  workbook.creator = input.organizationName;
  workbook.created = input.generatedAt ?? new Date();
  workbook.subject = input.reportTitle;

  input.sheets.forEach(dataSheet => {
    const worksheet = workbook.addWorksheet(dataSheet.name, { views: [{ state: 'frozen', ySplit: 1 }] });
    worksheet.columns = dataSheet.columns.map(column => {
      const widest = dataSheet.rows.reduce(
        (current, row) => Math.max(current, String(row[column] ?? '').length),
        column.length,
      );
      return { header: column, key: column, width: Math.min(52, Math.max(12, widest + 2)) };
    });
    worksheet.addRows(dataSheet.rows.map(row => Object.fromEntries(
      dataSheet.columns.map(column => [column, safeSpreadsheetText(row[column] ?? null)]),
    )));
    worksheet.autoFilter = dataSheet.columns.length > 0
      ? { from: { row: 1, column: 1 }, to: { row: 1, column: dataSheet.columns.length } }
      : undefined;
    worksheet.getRow(1).height = 24;
    worksheet.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
    worksheet.eachRow((row, index) => {
      if (index === 1) return;
      row.alignment = { vertical: 'top', wrapText: true };
      if (index % 2 === 0) {
        row.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        });
      }
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeFilename(input.reportTitle)}-data.xlsx`;
  anchor.hidden = true;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

import type { Product, QuestionnaireResponse } from '../data/survey-domain';
import type {
  ConceptResponse,
  ConceptTest,
  DecisionRecord,
  InstrumentalDataset,
  PanelistInfo,
} from './database';
import type { FormulationVersion } from './formulation-profile';
import type { ReportDataSectionKey, ReportDataSheet, ReportExportCell } from './commercialization-data-export';

export type ProjectDataSectionKey = Extract<ReportDataSectionKey,
  | 'report-summary'
  | 'product-records'
  | 'panelist-demographics'
  | 'food-panel-responses'
  | 'concept-test'
  | 'concept-responses'
  | 'decision-evidence'
  | 'e-tongue'
  | 'gc-ms'
  | 'composition'
  | 'formulation'
>;

export const PROJECT_DATA_SECTION_DEFINITIONS: Array<{
  key: ProjectDataSectionKey;
  group: 'Project' | 'Participants' | 'Food & science';
  label: string;
  description: string;
}> = [
  { key: 'report-summary', group: 'Project', label: 'Project overview', description: 'Project identity, export scope, and record counts.' },
  { key: 'product-records', group: 'Project', label: 'Sensory studies', description: 'Study setup, status, sample links, and assignment counts.' },
  { key: 'decision-evidence', group: 'Project', label: 'Decisions', description: 'Recorded GO, TWEAK, and STOP outcomes and evidence links.' },
  { key: 'panelist-demographics', group: 'Participants', label: 'Panelist demographics', description: 'De-identified profiles for participants represented in the exported responses.' },
  { key: 'food-panel-responses', group: 'Participants', label: 'Food-panel responses', description: 'CATA, intensity, liking, emotion, comments, and test metadata.' },
  { key: 'concept-test', group: 'Participants', label: 'Concept studies', description: 'Concept setup, positioning, assignments, and question wording.' },
  { key: 'concept-responses', group: 'Participants', label: 'Concept responses', description: 'One de-identified row per concept answer.' },
  { key: 'e-tongue', group: 'Food & science', label: 'E-tongue data', description: 'Taste-channel measurements for every project sample.' },
  { key: 'gc-ms', group: 'Food & science', label: 'GC-MS compounds', description: 'Volatile compounds, aromas, concentrations, and thresholds.' },
  { key: 'composition', group: 'Food & science', label: 'Composition data', description: 'Protein, fat, moisture, pH, salt, and calcium.' },
  { key: 'formulation', group: 'Food & science', label: 'Formulations', description: 'Saved formulation versions and reviewed ingredient records.' },
];

export interface ProjectDataExportInput {
  projectId?: string;
  projectName: string;
  organizationName: string;
  workspaceName: string;
  anonymizePanelists: boolean;
  products: Product[];
  foodPanelResponses: QuestionnaireResponse[];
  panelists: PanelistInfo[];
  concepts: ConceptTest[];
  conceptResponses: ConceptResponse[];
  decisions: DecisionRecord[];
  instrumentalDataset?: InstrumentalDataset;
  instrumentalSampleIds: Set<string>;
  formulationVersions: FormulationVersion[];
}

function createSheet(
  key: ProjectDataSectionKey,
  name: string,
  description: string,
  columns: string[],
  rows: Array<Record<string, ReportExportCell>>,
): ReportDataSheet {
  return { key, name, description, columns, rows };
}

function humanize(value: string | null | undefined) {
  return value ? value.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()) : '';
}

function textList(values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value)).join('; ');
}

function participantCodes(input: ProjectDataExportInput) {
  const ids = [...new Set([
    ...input.foodPanelResponses.map(response => response.userId),
    ...input.conceptResponses.map(response => response.userId),
  ])].sort();
  const panelistById = new Map(input.panelists.map(panelist => [panelist.id, panelist]));
  return new Map(ids.map((id, index) => {
    const registeredCode = panelistById.get(id)?.panelistId;
    const anonymousCode = `Participant ${String(index + 1).padStart(3, '0')}`;
    return [id, input.anonymizePanelists ? anonymousCode : registeredCode || anonymousCode];
  }));
}

function projectOverview(input: ProjectDataExportInput) {
  const rows: Array<Record<string, ReportExportCell>> = [
    { Field: 'Organization', Value: input.organizationName },
    { Field: 'Workspace', Value: input.workspaceName },
    { Field: 'Project', Value: input.projectName },
    { Field: 'Project ID', Value: input.projectId ?? 'All accessible projects' },
    { Field: 'Exported at', Value: new Date().toISOString() },
    { Field: 'Sensory studies', Value: input.products.length },
    { Field: 'Food-panel responses', Value: input.foodPanelResponses.length },
    { Field: 'Concept studies', Value: input.concepts.length },
    { Field: 'Concept responses', Value: input.conceptResponses.length },
    { Field: 'Decisions', Value: input.decisions.length },
    { Field: 'Instrumental samples', Value: input.instrumentalSampleIds.size },
    { Field: 'Formulation versions', Value: input.formulationVersions.length },
    { Field: 'Participant privacy', Value: input.anonymizePanelists ? 'Anonymous participant codes' : 'Registered panelist codes; direct contact details excluded' },
  ];
  return createSheet('report-summary', 'Project Overview', 'Project identity and export coverage.', ['Field', 'Value'], rows);
}

function productRecords(input: ProjectDataExportInput) {
  const columns = ['Study ID', 'Study', 'Category', 'Status', 'Created', 'Sample ID', 'Instrumental sample ID', 'Import batch ID', 'Assigned panelists', 'Survey sections', 'Multi-sample', 'Blinded'];
  const rows = input.products.map(product => ({
    'Study ID': product.id,
    Study: product.name,
    Category: product.category,
    Status: humanize(product.status),
    Created: product.createdDate,
    'Sample ID': product.sourceSampleId ?? '',
    'Instrumental sample ID': product.instrumentalSampleId ?? '',
    'Import batch ID': product.sourceImportBatchId ?? '',
    'Assigned panelists': product.assignedPanelistIds?.length ?? 0,
    'Survey sections': textList(product.surveySections ?? []),
    'Multi-sample': Boolean(product.isMultiSample),
    Blinded: Boolean(product.blinded),
  }));
  return createSheet('product-records', 'Sensory Studies', 'Sensory-study setup and sample links.', columns, rows);
}

function decisions(input: ProjectDataExportInput) {
  const columns = ['Decision ID', 'Recorded', 'Sample ID', 'Sample', 'Decision', 'ISSF score', 'Confidence', 'Method version', 'Note', 'Formulation version ID', 'Evidence bundle ID', 'Parent decision ID'];
  const rows = input.decisions.map(decision => ({
    'Decision ID': decision.id,
    Recorded: decision.timestamp,
    'Sample ID': decision.sampleId,
    Sample: decision.sampleName,
    Decision: decision.decision,
    'ISSF score': decision.issfScore,
    Confidence: decision.confidence,
    'Method version': decision.methodVersion,
    Note: decision.note,
    'Formulation version ID': decision.formulationVersionId ?? '',
    'Evidence bundle ID': decision.evidenceBundleId ?? '',
    'Parent decision ID': decision.parentDecisionId ?? '',
  }));
  return createSheet('decision-evidence', 'Decisions', 'Recorded project decisions.', columns, rows);
}

function demographics(input: ProjectDataExportInput, codes: Map<string, string>) {
  const represented = new Set(codes.keys());
  const columns = ['Participant code', 'Age', 'Age band', 'Gender', 'Nationality', 'Ethnicity', 'Dietary preference', 'Smoker status', 'Weekly food spend', 'Household size', 'Occupation group', 'Annual income range', 'Training level'];
  const rows = input.panelists.filter(panelist => represented.has(panelist.id)).map(panelist => ({
    'Participant code': codes.get(panelist.id) ?? '',
    Age: panelist.ageYears,
    'Age band': panelist.ageBand ?? '',
    Gender: panelist.gender === 'self_describe' ? panelist.genderSelfDescription ?? 'Self-described' : humanize(panelist.gender),
    Nationality: panelist.nationalityCode ?? '',
    Ethnicity: humanize(panelist.ethnicity),
    'Dietary preference': panelist.dietaryPattern === 'other' ? panelist.dietaryOther ?? 'Other' : humanize(panelist.dietaryPattern),
    'Smoker status': humanize(panelist.smokerStatus),
    'Weekly food spend': humanize(panelist.weeklyFoodSpend),
    'Household size': panelist.householdSizePreferNotToSay ? 'Prefer not to say' : panelist.householdSize,
    'Occupation group': humanize(panelist.occupationGroup),
    'Annual income range': humanize(panelist.annualIncomeRange),
    'Training level': humanize(panelist.trainingLevel),
  }));
  return createSheet('panelist-demographics', 'Panelist Demographics', 'De-identified participant demographics.', columns, rows);
}

function foodResponses(input: ProjectDataExportInput, codes: Map<string, string>) {
  const productById = new Map(input.products.map(product => [product.id, product]));
  const columns = ['Response ID', 'Participant code', 'Study', 'Submitted', 'Run', 'Session type', 'Sample code', 'CATA descriptors', 'Intensity ratings', 'Hedonic scores', 'Emotional profile', 'Comments', 'Different sample', 'Ranking', 'Presentation order'];
  const rows = input.foodPanelResponses.map(response => ({
    'Response ID': response.id,
    'Participant code': codes.get(response.userId) ?? '',
    Study: productById.get(response.productId)?.name ?? response.productId,
    Submitted: response.timestamp,
    Run: response.runNumber,
    'Session type': response.sessionType ?? '',
    'Sample code': response.sampleCode ?? '',
    'CATA descriptors': textList(response.cataAttributes),
    'Intensity ratings': JSON.stringify(response.intensityRatings),
    'Hedonic scores': JSON.stringify(response.hedonicScores),
    'Emotional profile': JSON.stringify(response.emotionalProfile),
    Comments: response.comments ?? '',
    'Different sample': response.differentSample ?? '',
    Ranking: textList(response.ranking ?? []),
    'Presentation order': textList(response.presentationOrder ?? []),
  }));
  return createSheet('food-panel-responses', 'Food Panel Responses', 'De-identified sensory responses.', columns, rows);
}

function conceptStudies(input: ProjectDataExportInput) {
  const columns = ['Concept ID', 'Concept', 'Category', 'Status', 'Description', 'Target market', 'Price point', 'Key benefits', 'Panel size', 'Assigned panelists', 'Created', 'Launched', 'Question ID', 'Question', 'Question type', 'Required', 'Options'];
  const rows = input.concepts.flatMap(concept => (concept.questions.length ? concept.questions : [null]).map(question => ({
    'Concept ID': concept.id,
    Concept: concept.name,
    Category: concept.category,
    Status: humanize(concept.status),
    Description: concept.description,
    'Target market': concept.targetMarket,
    'Price point': concept.pricePoint,
    'Key benefits': concept.keyBenefits,
    'Panel size': concept.panelSize,
    'Assigned panelists': concept.assignedPanelistIds.length,
    Created: concept.createdAt,
    Launched: concept.launchedAt ?? '',
    'Question ID': question?.id ?? '',
    Question: question?.text ?? '',
    'Question type': question ? humanize(question.type) : '',
    Required: question?.required ?? false,
    Options: textList(question?.options ?? []),
  })));
  return createSheet('concept-test', 'Concept Studies', 'Concept setup and questions.', columns, rows);
}

function conceptResponseRows(input: ProjectDataExportInput, codes: Map<string, string>) {
  const conceptById = new Map(input.concepts.map(concept => [concept.id, concept]));
  const columns = ['Response ID', 'Participant code', 'Concept', 'Submitted', 'Question ID', 'Question', 'Answer'];
  const rows = input.conceptResponses.flatMap(response => {
    const concept = conceptById.get(response.conceptTestId);
    const questionById = new Map((concept?.questions ?? []).map(question => [question.id, question.text]));
    return Object.entries(response.answers).map(([questionId, answer]) => ({
      'Response ID': response.id,
      'Participant code': codes.get(response.userId) ?? '',
      Concept: concept?.name ?? response.conceptTestId,
      Submitted: response.createdAt,
      'Question ID': questionId,
      Question: questionById.get(questionId) ?? '',
      Answer: Array.isArray(answer) ? textList(answer) : answer,
    }));
  });
  return createSheet('concept-responses', 'Concept Responses', 'De-identified concept answers.', columns, rows);
}

function instrumentalSamples(input: ProjectDataExportInput) {
  return (input.instrumentalDataset?.eTongueData ?? []).filter(sample => input.instrumentalSampleIds.has(sample.sampleId));
}

function eTongue(input: ProjectDataExportInput) {
  const columns = ['Sample ID', 'Sample', 'Category', 'Measurement', 'Value', 'Unit', 'Observation count'];
  const rows: Array<Record<string, ReportExportCell>> = [];
  instrumentalSamples(input).forEach(sample => {
    const base = { 'Sample ID': sample.sampleId, Sample: sample.sampleName ?? '', Category: sample.category ?? sample.type ?? '' };
    Object.entries({ Sourness: sample.sourness, Bitterness: sample.bitterness, Saltiness: sample.saltiness, Umami: sample.umami, Sweetness: sample.sweetness })
      .forEach(([measurement, value]) => rows.push({ ...base, Measurement: measurement, Value: value, Unit: '', 'Observation count': null }));
    (sample.measurements ?? []).forEach(measurement => rows.push({ ...base, Measurement: measurement.label, Value: measurement.mean, Unit: measurement.unit, 'Observation count': measurement.observationCount }));
  });
  return createSheet('e-tongue', 'E-Tongue', 'Electronic-tongue measurements.', columns, rows);
}

function gcMs(input: ProjectDataExportInput) {
  const columns = ['Sample ID', 'Compound', 'Concentration', 'Aroma', 'Threshold', 'Above threshold'];
  const rows = [...input.instrumentalSampleIds].flatMap(sampleId => (input.instrumentalDataset?.gcmsData[sampleId] ?? []).map(compound => ({
    'Sample ID': sampleId,
    Compound: compound.name,
    Concentration: compound.concentration,
    Aroma: compound.aroma,
    Threshold: compound.threshold,
    'Above threshold': compound.threshold > 0 && compound.concentration >= compound.threshold,
  })));
  return createSheet('gc-ms', 'GC-MS', 'GC-MS compound records.', columns, rows);
}

function composition(input: ProjectDataExportInput) {
  const columns = ['Sample ID', 'Protein', 'Fat', 'Moisture', 'pH', 'Salt', 'Calcium (mg)'];
  const rows = [...input.instrumentalSampleIds].flatMap(sampleId => {
    const record = input.instrumentalDataset?.compositionData[sampleId];
    return record ? [{ 'Sample ID': sampleId, Protein: record.protein, Fat: record.fat, Moisture: record.moisture, pH: record.pH, Salt: record.saltContent, 'Calcium (mg)': record.calciumMg }] : [];
  });
  return createSheet('composition', 'Composition', 'Composition measurements.', columns, rows);
}

function formulations(input: ProjectDataExportInput) {
  const columns = ['Version ID', 'Sample ID', 'Sample', 'Version', 'Current', 'Review status', 'Exact statement', 'Position', 'Ingredient', 'Canonical name', 'Functional role', 'Percentage', 'Allergens', 'Dietary tags', 'Ingredient review', 'Notes'];
  const rows = input.formulationVersions.flatMap(version => (version.ingredients.length ? version.ingredients : [null]).map(ingredient => ({
    'Version ID': version.id,
    'Sample ID': version.sampleId,
    Sample: version.sampleName ?? '',
    Version: version.versionNumber,
    Current: version.isCurrent,
    'Review status': humanize(version.reviewStatus),
    'Exact statement': version.exactStatement,
    Position: ingredient?.position ?? null,
    Ingredient: ingredient?.suppliedName ?? '',
    'Canonical name': ingredient?.canonicalName ?? '',
    'Functional role': ingredient?.functionalRole ?? '',
    Percentage: ingredient?.percentage ?? null,
    Allergens: textList(ingredient?.allergenTags ?? []),
    'Dietary tags': textList(ingredient?.dietaryTags ?? []),
    'Ingredient review': humanize(ingredient?.reviewStatus),
    Notes: ingredient?.notes ?? version.changeSummary ?? '',
  })));
  return createSheet('formulation', 'Formulations', 'Formulation and ingredient versions.', columns, rows);
}

export function buildProjectDataSheets(input: ProjectDataExportInput): ReportDataSheet[] {
  const codes = participantCodes(input);
  return [
    projectOverview(input),
    productRecords(input),
    decisions(input),
    demographics(input, codes),
    foodResponses(input, codes),
    conceptStudies(input),
    conceptResponseRows(input, codes),
    eTongue(input),
    gcMs(input),
    composition(input),
    formulations(input),
  ];
}

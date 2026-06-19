import type { CommercializationProjectProfile } from '../lib/report-evidence-types';

/**
 * Rich reference/demo dossier for the Coconut Cheddar v3.0 regression product.
 *
 * This is not live client evidence. Facts are limited to the existing S4
 * sensory/instrumental reference dataset. Product, market, packaging, price,
 * and execution content is explicitly labeled as a hypothesis or readiness gap.
 */
export const COCONUT_CHEDDAR_PROFILE: CommercializationProjectProfile = {
  sampleId: 'S4',
  evidenceStatus: 'reference_demo',
  evidenceLabel: 'Reference/demo dossier - replace with collected client evidence before approval or external use.',
  product: {
    productName: 'Coconut Cheddar v3.0',
    category: 'Plant-based cheddar-style cheese alternative',
    baseSystem: 'Coconut-based',
    formatHypothesis: 'Slice or block format for melting and everyday cooking; format is not yet validated.',
    developmentStage: 'Prototype screening complete; pilot-scale validation required.',
    intendedUseHypotheses: ['Burgers and hot sandwiches', 'Toasties and grilled sandwiches', 'Everyday cooked meals'],
  },
  development: {
    objective: 'Retain cheddar-category recognition and high creamy/smooth intensity while establishing the missing firmness and spreadability evidence needed for pilot readiness.',
    strengths: [
      'Sensory acceptance 84/100 in the reference panel',
      'Descriptor profile 99/100 with high agreement on cheese, butter, lactic-acid, and milk descriptors',
      'Positive emotional-response indicators 86/100 in the tested panel',
      'No critical off-note gate failure in the reference instrumental record',
    ],
    technicalRisks: [
      'Texture composite is 43/100 because firm and spreadable cues were not captured and count as zero in the production score.',
      'Pilot-scale texture, melt behavior, process tolerance, shelf life, and package compatibility are not validated.',
      'The current evidence does not establish consumer preference, demand, price acceptance, or market readiness.',
    ],
    formulationKnown: [
      'Reference composition record: salt 1.9%, fat 25.1%, protein 8.4%, starch/dry-matter field 11.9%.',
      'Reference sensory profile shows creamy 8.4/10 and smooth 8.6/10.',
      'Reference negative texture cues are low: grainy 1.8/10 and chalky 1.2/10.',
    ],
    formulationUnknown: [
      'Ingredient statement and formula percentages',
      'Firming system and hydrocolloid/protein functionality',
      'Thermal process, shear, cooling, and maturation conditions',
      'Melt, stretch, oiling-off, sliceability, and fracture measurements',
      'Microbiological, chemical, and sensory shelf-life limits',
      'Allergen, nutrition, regulatory, and manufacturing-cost review',
    ],
  },
  studyDesign: {
    sensoryPopulation: 'Reference semi-trained sensory panel n=14',
    conceptPopulation: 'No validated target-consumer concept study is linked to this decision snapshot.',
    instrumentalPopulation: 'Reference instrument snapshot for batch S4; replicate structure is not documented beyond the stored QC record.',
    sensoryMethod: 'ISSF sensory screening using hedonic, texture-intensity, CATA descriptor, and emotional-response inputs.',
    instrumentalMethod: 'Taste/composition transform, GC-MS/GC-O off-note review, and internal-standard recovery QC.',
    collectionBoundary: 'Reference/demo evidence for workflow and regression testing, not a representative market sample.',
  },
  instrumentalSummary: [
    { source: 'E-tongue / taste profile', finding: 'Sourness 2.1, bitterness 3.6, umami 3.3, saltiness 4.1, sweetness 1.4', benchmark: 'Production instrument-signal transform', effect: 'supports' },
    { source: 'GC-MS / GC-O', finding: 'Diacetyl 3.6 with buttery aroma; benzaldehyde 1.4 with nutty/almond aroma', benchmark: 'No critical off-note gate failure', effect: 'supports' },
    { source: 'Internal-standard QC', finding: 'Recovery 95.1%', benchmark: 'Pass range 85-110%', effect: 'supports' },
  ],
  conceptHypothesis: {
    positioning: 'For flexitarian shoppers seeking a familiar plant-based cheddar for everyday cooking, Coconut Cheddar v3.0 proposes recognizable cheddar-category cues in a coconut-based format.',
    targetSegment: 'Hypothesis: flexitarian households and plant-based shoppers who prioritize familiar cheddar cues, melting utility, and routine meal versatility.',
    consumerNeed: 'Hypothesis: a dairy-free cheddar alternative that feels familiar and practical in cooked meals.',
    usageOccasion: 'Hypothesis: burgers, hot sandwiches, toasties, and simple weeknight meals.',
    productPromise: 'Hypothesis: familiar cheddar-category character with a creamy, smooth eating experience.',
    reasonsToBelieve: [
      'Reference panel agreement on cheddar-category descriptors: cheese, butter, lactic acid, and milk',
      'Reference creamy and smooth intensity results',
      'Reference instrumental record with no critical off-note gate failure',
    ],
    priceHypothesis: 'Test $5.99-$7.49 per 7-8 oz pack against format, competitive set, and willingness to pay.',
    packagingHypothesis: 'Communicate plant-based cheddar and cooking versatility while clearly labeling imagery and claims as directional.',
    validationQuestions: [
      'Does the concept communicate plant-based cheddar clearly?',
      'Does coconut naming create positive or negative expectations?',
      'Which usage occasion is most credible?',
      'Is the proposed price range acceptable?',
      'Does the package overpromise firmness, melt, or texture performance?',
      'What drives and limits purchase intent?',
    ],
  },
  claimsBoundary: {
    supportedInternalLanguage: [
      'Strong cheddar-category recognition in the reference sensory panel',
      'High panel agreement on core dairy-style descriptors',
      'High creamy and smooth intensity in the tested reference sample',
      'Sensory screening supports continued development',
    ],
    prohibitedUntilValidated: [
      'Consumer preferred',
      'Purchase intent validated',
      'Market-ready or launch-ready',
      'Distinctive, unique, superior, or category-leading',
      'Nutrition, health, sustainability, or clean-label claims',
    ],
    requiredReviews: ['Target-consumer concept validation', 'Claims and legal review', 'Nutrition and allergen review', 'Packaging and labeling review'],
  },
  actionPlan: [
    {
      workstream: 'Pilot formulation and process',
      owner: 'Not assigned - readiness gap',
      team: 'R&D / Process Development',
      dueDate: null,
      priority: 'critical',
      action: 'Produce a pilot batch with documented formula, process conditions, and batch genealogy.',
      completionEvidence: 'Approved pilot batch record and retained sample',
      passingCriteria: 'Batch is reproducible and suitable for sensory, instrumental, shelf-life, and packaging validation.',
      dependencies: ['Formula disclosure', 'Pilot-line availability', 'Raw-material specifications'],
      nextGate: 'Pilot validation',
    },
    {
      workstream: 'Texture and functionality',
      owner: 'Not assigned - readiness gap',
      team: 'R&D / Sensory',
      dueDate: null,
      priority: 'critical',
      action: 'Measure firmness, spreadability, melt, oiling-off, sliceability, and overall texture liking against a defined target.',
      completionEvidence: 'Pilot-scale sensory and instrumental texture dataset',
      passingCriteria: 'Texture score >=60/100, sensory panel n>=18, and no critical functionality failure.',
      dependencies: ['Pilot batch', 'Texture target specification', 'Comparator selection'],
      nextGate: 'Pilot validation',
    },
    {
      workstream: 'Consumer concept validation',
      owner: 'Not assigned - readiness gap',
      team: 'Consumer Insights / Commercial',
      dueDate: null,
      priority: 'high',
      action: 'Test positioning, naming, usage occasion, packaging, price, and purchase intent with the defined target population.',
      completionEvidence: 'Clean concept-test dataset with documented target-panel fit',
      passingCriteria: 'Concept test n>=30 with predefined pass/watch/fail thresholds and no unsupported market conclusion.',
      dependencies: ['Approved directional concept', 'Price range', 'Target segment definition'],
      nextGate: 'Concept validation',
    },
    {
      workstream: 'Shelf life and package',
      owner: 'Not assigned - readiness gap',
      team: 'Quality / Packaging',
      dueDate: null,
      priority: 'high',
      action: 'Define package format and run microbiological, chemical, physical, and sensory shelf-life validation.',
      completionEvidence: 'Shelf-life protocol, package specification, and approved results',
      passingCriteria: 'Product remains within safety, quality, texture, aroma, and package-integrity limits through the proposed life.',
      dependencies: ['Pilot batch', 'Package prototype', 'Storage conditions'],
      nextGate: 'Commercial preparation',
    },
    {
      workstream: 'Claims and regulatory',
      owner: 'Not assigned - readiness gap',
      team: 'Legal / Regulatory',
      dueDate: null,
      priority: 'high',
      action: 'Create a claim-by-claim substantiation matrix and review ingredients, allergens, nutrition, naming, and label requirements.',
      completionEvidence: 'Signed regulatory and legal review record',
      passingCriteria: 'Every external claim is approved and mapped to evidence; unresolved claims are removed.',
      dependencies: ['Final formula', 'Nutrition analysis', 'Final packaging copy'],
      nextGate: 'Claims approval',
    },
  ],
};

export function getCommercializationProjectProfile(sampleId: string | null | undefined) {
  return sampleId === COCONUT_CHEDDAR_PROFILE.sampleId ? COCONUT_CHEDDAR_PROFILE : null;
}

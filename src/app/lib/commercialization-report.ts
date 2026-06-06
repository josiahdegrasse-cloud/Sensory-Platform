import type { ConceptQuestion, ConceptResponse, ConceptTest, DecisionRecord } from './database';
import type { GoStopTweakDecision } from '../utils/go-stop-tweak-engine';

export interface ConceptEvidenceSummary {
  responseCount: number;
  scaleMetrics: Array<{ question: string; average: number; count: number }>;
  topSelections: Array<{ option: string; count: number; percentage: number }>;
  comments: string[];
  purchaseIntent: number | null;
}

export interface CommercializationReportSnapshot {
  product: {
    sampleId: string;
    sampleName: string;
    foodType: string;
  };
  decision: {
    recordId: string;
    outcome: 'GO';
    issfScore: number;
    confidence: number;
    recommendation: string;
    dimensions: GoStopTweakDecision['dimensionScores'];
    prescriptions: GoStopTweakDecision['prescriptions'];
    methodVersion: string;
    fingerprint: string;
  };
  concept: {
    id: string;
    name: string;
    description: string;
    targetMarket: string;
    pricePoint: string;
    keyBenefits: string;
    packagingImageId: string | null;
    packagingImageUrl: string;
  };
  evidence: ConceptEvidenceSummary;
  narrative: {
    executiveSummary: string;
    whyLiked: string;
    packagingRationale: string;
    launchRecommendation: string;
    claimCaution: string;
  };
  generatedAt: string;
}

function questionById(questions: ConceptQuestion[]) {
  return new Map(questions.map(question => [question.id, question]));
}

export function summarizeConceptResponses(
  questions: ConceptQuestion[],
  responses: ConceptResponse[],
): ConceptEvidenceSummary {
  const byId = questionById(questions);
  const scales = new Map<string, number[]>();
  const selections = new Map<string, number>();
  const comments: string[] = [];
  const purchaseScores: number[] = [];

  responses.forEach(response => {
    Object.entries(response.answers).forEach(([questionId, answer]) => {
      const question = byId.get(questionId);
      if (!question) return;
      if (typeof answer === 'number') {
        const values = scales.get(question.text) ?? [];
        values.push(answer);
        scales.set(question.text, values);
        if (question.category === 'purchase') purchaseScores.push(answer);
      } else if (Array.isArray(answer)) {
        answer.forEach(option => selections.set(option, (selections.get(option) ?? 0) + 1));
      } else if (question.type === 'open_text' && answer.trim()) {
        comments.push(answer.trim());
      } else if (answer.trim()) {
        selections.set(answer, (selections.get(answer) ?? 0) + 1);
      }
    });
  });

  return {
    responseCount: responses.length,
    scaleMetrics: [...scales.entries()]
      .map(([question, values]) => ({
        question,
        average: values.reduce((sum, value) => sum + value, 0) / values.length,
        count: values.length,
      }))
      .sort((a, b) => b.average - a.average),
    topSelections: [...selections.entries()]
      .map(([option, count]) => ({
        option,
        count,
        percentage: responses.length ? (count / responses.length) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    comments: comments.slice(0, 12),
    purchaseIntent: purchaseScores.length
      ? purchaseScores.reduce((sum, value) => sum + value, 0) / purchaseScores.length
      : null,
  };
}

export function buildCommercializationSnapshot(input: {
  decisionRecord: DecisionRecord;
  liveDecision: GoStopTweakDecision;
  concept: ConceptTest;
  responses: ConceptResponse[];
  foodType: string;
  packagingImageId: string | null;
  packagingImageUrl: string;
}): CommercializationReportSnapshot {
  if (input.decisionRecord.decision !== 'GO' || input.liveDecision.decision !== 'GO') {
    throw new Error('Commercialization reports require a confirmed GO decision.');
  }
  const evidence = summarizeConceptResponses(input.concept.questions, input.responses);
  const strongestDimensions = Object.entries(input.liveDecision.dimensionScores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2)
    .map(([name, score]) => `${name} (${score.toFixed(0)})`);
  const likedSignals = [
    ...evidence.topSelections.slice(0, 3).map(item => item.option),
    ...strongestDimensions,
  ];

  return {
    product: {
      sampleId: input.liveDecision.sampleId,
      sampleName: input.liveDecision.sampleName,
      foodType: input.foodType,
    },
    decision: {
      recordId: input.decisionRecord.id,
      outcome: 'GO',
      issfScore: input.liveDecision.issfScore,
      confidence: input.liveDecision.confidenceScore,
      recommendation: input.liveDecision.recommendation,
      dimensions: input.liveDecision.dimensionScores,
      prescriptions: input.liveDecision.prescriptions,
      methodVersion: input.liveDecision.methodVersion,
      fingerprint: input.liveDecision.decisionFingerprint,
    },
    concept: {
      id: input.concept.id,
      name: input.concept.name,
      description: input.concept.description,
      targetMarket: input.concept.targetMarket,
      pricePoint: input.concept.pricePoint,
      keyBenefits: input.concept.keyBenefits,
      packagingImageId: input.packagingImageId,
      packagingImageUrl: input.packagingImageUrl,
    },
    evidence,
    narrative: {
      executiveSummary: `${input.liveDecision.sampleName} has a confirmed GO decision with an ISSF score of ${input.liveDecision.issfScore.toFixed(1)} and ${input.liveDecision.confidenceScore.toFixed(0)}% confidence. The linked ${input.concept.name} concept was evaluated by ${evidence.responseCount} panelist${evidence.responseCount === 1 ? '' : 's'}.`,
      whyLiked: likedSignals.length
        ? `The strongest evidence supporting launch is ${likedSignals.join(', ')}. These signals combine formulation performance with the language panelists used when evaluating the concept.`
        : `The formulation achieved a GO decision through its sensory performance. Additional concept responses will strengthen the consumer-language evidence.`,
      packagingRationale: input.packagingImageUrl
        ? `The selected packaging expresses the approved concept positioning for ${input.concept.targetMarket || 'the target market'} and should remain the lead visual through buyer review.`
        : 'A packaging visual must be selected before this report can be approved.',
      launchRecommendation: `Advance the formulation and selected packaging into buyer review, preserving the decision fingerprint ${input.liveDecision.decisionFingerprint}.`,
      claimCaution: 'Panel findings support this tested concept and panel. Broader consumer or commercial claims require representative validation and legal review.',
    },
    generatedAt: new Date().toISOString(),
  };
}

import { useMemo, useState } from "react";
import { ESSENSE25_EMOTIONS, type QuestionnaireResponse } from "../data/survey-domain";
import { useAllResponses, useProducts } from "./hooks";

export interface LiveAggregation {
  productId: string;
  productName: string;
  sourceSampleId?: string | null;
  category?: string;
  n: number;
  cata: Record<string, number>;
  intensity: Record<string, number>;
  intensityN?: Record<string, number>;
  hedonic: Record<string, number>;
  hedonicSD: Record<string, number>;
  hedonicN?: Record<string, number>;
  emotions: { positive: number; negative: number };
  emotionN?: { positive: number; negative: number };
}

type AggregationProduct = { id: string; name: string; sourceSampleId?: string | null; category?: string };

function numericValues(values: unknown[]): number[] {
  return values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
}

export function aggregateLiveQuestionnaireResponses(
  resps: QuestionnaireResponse[],
  product?: AggregationProduct,
): LiveAggregation {
  const n = resps.length;
  const productId = product?.id ?? resps[0]?.productId ?? '';
  const cata: Record<string, number> = {};
  resps.forEach(response => {
    (response.cataAttributes || []).forEach(attribute => { cata[attribute] = (cata[attribute] || 0) + 1; });
  });

  const intensityTotals: Record<string, { sum: number; count: number }> = {};
  resps.forEach(response => {
    Object.entries(response.intensityRatings || {}).forEach(([attribute, rawValue]) => {
      const value = Number(rawValue);
      if (!Number.isFinite(value)) return;
      if (!intensityTotals[attribute]) intensityTotals[attribute] = { sum: 0, count: 0 };
      intensityTotals[attribute].sum += value;
      intensityTotals[attribute].count += 1;
    });
  });

  const hedonicKeys = ['overall', 'appearance', 'aroma', 'flavor', 'texture'] as const;
  const hedonic: Record<string, number> = {};
  const hedonicSD: Record<string, number> = {};
  const hedonicN: Record<string, number> = {};
  hedonicKeys.forEach(key => {
    const values = numericValues(resps.map(response => response.hedonicScores?.[key]));
    if (values.length === 0) return;
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    hedonic[key] = mean;
    hedonicN[key] = values.length;
    hedonicSD[key] = values.length > 1
      ? Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1))
      : 0;
  });

  const positiveValues = numericValues(resps.flatMap(response =>
    ESSENSE25_EMOTIONS.positive.map(emotion => response.emotionalProfile?.[emotion]),
  ));
  const negativeValues = numericValues(resps.flatMap(response =>
    ESSENSE25_EMOTIONS.negative.map(emotion => response.emotionalProfile?.[emotion]),
  ));
  const meanOrZero = (values: number[]) => values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;

  return {
    productId,
    productName: product?.name ?? productId,
    sourceSampleId: product?.sourceSampleId,
    category: product?.category,
    n,
    cata,
    intensity: Object.fromEntries(Object.entries(intensityTotals).map(([key, value]) => [key, value.sum / value.count])),
    intensityN: Object.fromEntries(Object.entries(intensityTotals).map(([key, value]) => [key, value.count])),
    hedonic,
    hedonicSD,
    hedonicN,
    emotions: { positive: meanOrZero(positiveValues), negative: meanOrZero(negativeValues) },
    emotionN: { positive: positiveValues.length, negative: negativeValues.length },
  };
}

interface MultiSampleSession {
  id: string;
  userId: string;
  productId: string;
  differentSample: string;
  ranking: string[];
  samples: {
    sampleCode: string;
    cataAttributes: string[];
    intensityRatings: Record<string, number>;
    hedonicScores: QuestionnaireResponse['hedonicScores'];
    emotionalProfile: Record<string, number>;
  }[];
}

interface UseSurveyDataResult {
  isLoading: boolean;
  isFetched: boolean;
  liveDataFetchFailed: boolean;
  multiSampleResponses: MultiSampleSession[];
  selectedMultiProduct: string;
  setSelectedMultiProduct: (id: string) => void;
  responses: QuestionnaireResponse[];
  liveAggregations: LiveAggregation[];
  commentsByProduct: Record<string, string[]>;
}

export function selectPrimaryQuestionnaireResponses(
  responses: readonly QuestionnaireResponse[],
): QuestionnaireResponse[] {
  const primaryByParticipant = new Map<string, QuestionnaireResponse>();
  responses.forEach(response => {
    const key = `${response.userId}:${response.productId}`;
    const current = primaryByParticipant.get(key);
    if (!current || response.runNumber < current.runNumber) primaryByParticipant.set(key, response);
  });
  return [...primaryByParticipant.values()];
}

export function useSurveyData(): UseSurveyDataResult {
  const responsesQuery = useAllResponses();
  const productsQuery = useProducts();
  const { data: allResponsesData, isError: liveDataFetchFailed } = responsesQuery;
  const { data: products = [] } = productsQuery;

  // Explicit user selection; when empty we fall back to the first available
  // session below (derived, not mirrored into state via an effect).
  const [selectedOverride, setSelectedMultiProduct] = useState<string>('');

  // Multi-sample: group per-sample rows into session-level objects.
  const multiSampleResponses = useMemo<MultiSampleSession[]>(() => {
    if (!allResponsesData) return [];
    const multiRows = allResponsesData.filter((r: QuestionnaireResponse) =>
      r.sessionType?.endsWith('-sample-sequential')
    );
    const sessionMap = new Map<string, MultiSampleSession>();
    multiRows.forEach((r: QuestionnaireResponse) => {
      const key = r.responseSessionId ?? `${r.userId}:${r.productId}:legacy`;
      if (!sessionMap.has(key)) {
        sessionMap.set(key, {
          id: r.responseSessionId ?? r.id,
          userId: r.userId,
          productId: r.productId,
          differentSample: r.differentSample ?? '',
          ranking: r.ranking ?? [],
          samples: [],
        });
      }
      sessionMap.get(key)!.samples.push({
        sampleCode: r.sampleCode ?? '',
        cataAttributes: r.cataAttributes,
        intensityRatings: r.intensityRatings,
        hedonicScores: r.hedonicScores,
        emotionalProfile: r.emotionalProfile,
      });
    });
    return Array.from(sessionMap.values());
  }, [allResponsesData]);

  // Single-sample aggregations + free-text comments, derived from live responses.
  const { liveAggregations, commentsByProduct } = useMemo<{
    liveAggregations: LiveAggregation[];
    commentsByProduct: Record<string, string[]>;
  }>(() => {
    if (!allResponsesData) return { liveAggregations: [], commentsByProduct: {} };
    const productsById = new Map(products.map(product => [product.id, product]));

    const singleResponses = selectPrimaryQuestionnaireResponses(allResponsesData.filter(
      (r: QuestionnaireResponse) => !r.sessionType
    ));
    if (singleResponses.length === 0) return { liveAggregations: [], commentsByProduct: {} };

    const grouped = new Map<string, QuestionnaireResponse[]>();
    singleResponses.forEach((r: QuestionnaireResponse) => {
      if (!grouped.has(r.productId)) grouped.set(r.productId, []);
      grouped.get(r.productId)!.push(r);
    });

    const aggregations: LiveAggregation[] = [];
    grouped.forEach((resps, productId) => {
      const product = productsById.get(productId);
      aggregations.push(aggregateLiveQuestionnaireResponses(resps, product));
    });

    const commentsMap: Record<string, string[]> = {};
    singleResponses.forEach((r: QuestionnaireResponse) => {
      if (r.comments && r.comments.trim()) {
        if (!commentsMap[r.productId]) commentsMap[r.productId] = [];
        commentsMap[r.productId].push(r.comments.trim());
      }
    });

    return { liveAggregations: aggregations, commentsByProduct: commentsMap };
  }, [allResponsesData, products]);

  const selectedMultiProduct = selectedOverride || multiSampleResponses[0]?.productId || '';

  return {
    isLoading: responsesQuery.isLoading || productsQuery.isLoading,
    isFetched: responsesQuery.isFetched && productsQuery.isFetched,
    liveDataFetchFailed: !!liveDataFetchFailed,
    multiSampleResponses,
    selectedMultiProduct,
    setSelectedMultiProduct,
    responses: allResponsesData ?? [],
    liveAggregations,
    commentsByProduct,
  };
}

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
  hedonic: Record<string, number>;
  hedonicSD: Record<string, number>;
  emotions: { positive: number; negative: number };
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
      const key = `${r.userId}:${r.productId}`;
      if (!sessionMap.has(key)) {
        sessionMap.set(key, {
          id: r.id,
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

    const singleResponses = allResponsesData.filter(
      (r: QuestionnaireResponse) => !r.sessionType
    );
    if (singleResponses.length === 0) return { liveAggregations: [], commentsByProduct: {} };

    const grouped = new Map<string, QuestionnaireResponse[]>();
    singleResponses.forEach((r: QuestionnaireResponse) => {
      if (!grouped.has(r.productId)) grouped.set(r.productId, []);
      grouped.get(r.productId)!.push(r);
    });

    const aggregations: LiveAggregation[] = [];
    grouped.forEach((resps, productId) => {
      const n = resps.length;
      const product = productsById.get(productId);

      const cata: Record<string, number> = {};
      resps.forEach(r => {
        (r.cataAttributes || []).forEach(attr => { cata[attr] = (cata[attr] || 0) + 1; });
      });

      const intensityTotals: Record<string, { sum: number; count: number }> = {};
      resps.forEach(r => {
        Object.entries(r.intensityRatings || {}).forEach(([attr, val]) => {
          if (!intensityTotals[attr]) intensityTotals[attr] = { sum: 0, count: 0 };
          intensityTotals[attr].sum += Number(val);
          intensityTotals[attr].count += 1;
        });
      });

      const hedonicKeys = ['overall', 'appearance', 'aroma', 'flavor', 'texture'] as const;
      const hedonicSums: Record<string, number> = { overall: 0, appearance: 0, aroma: 0, flavor: 0, texture: 0 };
      resps.forEach(r => {
        hedonicKeys.forEach(k => { hedonicSums[k] += (r.hedonicScores as Record<string, number>)?.[k] || 0; });
      });
      const hedonicMeans = Object.fromEntries(hedonicKeys.map(k => [k, hedonicSums[k] / n]));
      const hedonicSDs: Record<string, number> = {};
      hedonicKeys.forEach(k => {
        const vals = resps.map(r => (r.hedonicScores as Record<string, number>)?.[k] || 0);
        const mean = hedonicMeans[k];
        hedonicSDs[k] = Math.sqrt(vals.reduce((acc, v) => acc + (v - mean) ** 2, 0) / n);
      });

      let posSum = 0, negSum = 0;
      resps.forEach(r => {
        ESSENSE25_EMOTIONS.positive.forEach(e => { posSum += (r.emotionalProfile || {})[e] || 0; });
        ESSENSE25_EMOTIONS.negative.forEach(e => { negSum += (r.emotionalProfile || {})[e] || 0; });
      });

      aggregations.push({
        productId,
        productName: product?.name ?? productId,
        sourceSampleId: product?.sourceSampleId,
        category: product?.category,
        n,
        cata,
        intensity: Object.fromEntries(
          Object.entries(intensityTotals).map(([k, v]) => [k, v.sum / v.count])
        ),
        hedonic: Object.fromEntries(hedonicKeys.map(k => [k, hedonicSums[k] / n])),
        hedonicSD: hedonicSDs,
        emotions: {
          positive: posSum / (n * ESSENSE25_EMOTIONS.positive.length),
          negative: negSum / (n * ESSENSE25_EMOTIONS.negative.length),
        },
      });
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

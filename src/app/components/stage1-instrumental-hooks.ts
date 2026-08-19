import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { SAMPLES } from '../data/samples';
import { parseBatchSelection } from '../lib/project-identity';
import { formatFoodTypeLabel } from '../lib/food-intelligence';
import {
  instrumentalComparisonColor,
  normaliseInstrumentalComparisonSelection,
} from '../lib/instrumental-comparison';
import {
  type ChemicalComposition,
  type ETongueMeasurement,
  type GCMSCompound,
  DEMO_TYPES,
  inferCategory,
  inferType,
  mergeInstrumentalData,
  getPointColor,
} from './stage1-instrumental-data';

interface UseInstrumentalWorkspaceArgs {
  remoteDataset?: {
    eTongueData: ETongueMeasurement[];
    gcmsData: Record<string, GCMSCompound[]>;
    compositionData: Record<string, ChemicalComposition>;
  };
  foodType: string;
  subCategory: string | null;
  archivedFoodTypes: string[];
  deletedFoodTypes: string[];
  registerFoodTypes: (types: string[]) => void;
  setSelection: (foodType: string, subCategory: string | null) => void;
  onDeleteSuccess?: (message: string) => void;
}

interface InstrumentalDatasetState {
  eTongueData: ETongueMeasurement[];
  gcmsData: Record<string, GCMSCompound[]>;
  compositionData: Record<string, ChemicalComposition>;
}

function resolveState<T>(next: SetStateAction<T>, previous: T): T {
  return typeof next === 'function' ? (next as (value: T) => T)(previous) : next;
}

export function useInstrumentalWorkspace({
  remoteDataset,
  foodType,
  subCategory,
  archivedFoodTypes,
  deletedFoodTypes,
  registerFoodTypes,
  setSelection,
  onDeleteSuccess,
}: UseInstrumentalWorkspaceArgs) {
  const initialDataset = useMemo(() => mergeInstrumentalData(null), []);
  const remoteMergedDataset = useMemo<InstrumentalDatasetState | null>(() => (
    remoteDataset && remoteDataset.eTongueData.length > 0 ? mergeInstrumentalData(remoteDataset) : null
  ), [remoteDataset]);
  const [selectedSamples, setSelectedSamples] = useState<string[]>([]);
  const [localETongueData, setLocalETongueData] = useState<ETongueMeasurement[] | null>(null);
  const [localGcmsData, setLocalGcmsData] = useState<Record<string, GCMSCompound[]> | null>(null);
  const [localCompositionData, setLocalCompositionData] = useState<Record<string, ChemicalComposition> | null>(null);
  const [compareMode, setCompareMode] = useState(false);

  const eTongueData = localETongueData ?? remoteMergedDataset?.eTongueData ?? initialDataset.eTongueData;
  const gcmsData = localGcmsData ?? remoteMergedDataset?.gcmsData ?? initialDataset.gcmsData;
  const compositionData = localCompositionData ?? remoteMergedDataset?.compositionData ?? initialDataset.compositionData;

  const setETongueData: Dispatch<SetStateAction<ETongueMeasurement[]>> = useCallback((next) => {
    setLocalETongueData(previous => resolveState(
      next,
      previous ?? remoteMergedDataset?.eTongueData ?? initialDataset.eTongueData,
    ));
  }, [initialDataset.eTongueData, remoteMergedDataset]);

  const setGcmsData: Dispatch<SetStateAction<Record<string, GCMSCompound[]>>> = useCallback((next) => {
    setLocalGcmsData(previous => resolveState(
      next,
      previous ?? remoteMergedDataset?.gcmsData ?? initialDataset.gcmsData,
    ));
  }, [initialDataset.gcmsData, remoteMergedDataset]);

  const setCompositionData: Dispatch<SetStateAction<Record<string, ChemicalComposition>>> = useCallback((next) => {
    setLocalCompositionData(previous => resolveState(
      next,
      previous ?? remoteMergedDataset?.compositionData ?? initialDataset.compositionData,
    ));
  }, [initialDataset.compositionData, remoteMergedDataset]);

  const importedFoodTypes = useMemo(() => [...new Set(
    eTongueData.map(sample => sample.type).filter((type): type is string => !!type && !DEMO_TYPES.has(type))
  )].sort(), [eTongueData]);

  useEffect(() => {
    registerFoodTypes(importedFoodTypes);
  }, [importedFoodTypes, registerFoodTypes]);

  const filteredETongueData = useMemo(() => eTongueData.filter(sample => {
    const type = (sample.type || inferType(sample.sampleId)).toLowerCase();
    const canonicalType = type === 'dairy' || type === 'pbca' ? 'cheese' : type;
    if (archivedFoodTypes.includes(canonicalType)) return false;
    if (deletedFoodTypes.includes(canonicalType)) return false;
    const batchSelection = parseBatchSelection(subCategory);
    if (batchSelection) return sample.importBatchId === batchSelection;
    if (foodType === 'all') return true;
    if (foodType === 'bread') return type === 'bread' || sample.sampleId.toUpperCase().startsWith('B');
    if (foodType === 'cheese') return type === 'dairy' || type === 'pbca' || sample.sampleId.toUpperCase().startsWith('S') || sample.sampleId.toUpperCase().startsWith('D');
    if (foodType === 'meat') return type === 'meat' || sample.sampleId.toUpperCase().startsWith('M');
    return type === foodType.toLowerCase();
  }), [archivedFoodTypes, deletedFoodTypes, eTongueData, foodType, subCategory]);

  const activeSelectedSamples = useMemo(() => {
    const availableSampleIds = new Set(filteredETongueData.map(sample => sample.sampleId));
    const availableSelectedSamples = normaliseInstrumentalComparisonSelection(
      selectedSamples.filter(sampleId => availableSampleIds.has(sampleId)),
    );
    if (availableSelectedSamples.length > 0) return availableSelectedSamples;
    return filteredETongueData[0] ? [filteredETongueData[0].sampleId] : [];
  }, [filteredETongueData, selectedSamples]);

  const deleteImportedFoodTypeData = (type: string) => {
    const sampleIds = eTongueData.filter(sample => sample.type === type).map(sample => sample.sampleId);
    const remainingETongueData = eTongueData.filter(sample => sample.type !== type);
    if (remainingETongueData.length === 0) {
      setETongueData([]);
      setGcmsData({});
      setCompositionData({});
      setSelectedSamples([]);
      if (foodType === type) setSelection('', null);
      onDeleteSuccess?.(`Deleted ${formatFoodTypeLabel(type)} data.`);
      return;
    }
    setETongueData(remainingETongueData);
    setGcmsData(previous => {
      const next = { ...previous };
      sampleIds.forEach(sampleId => { delete next[sampleId]; });
      return next;
    });
    setCompositionData(previous => {
      const next = { ...previous };
      sampleIds.forEach(sampleId => { delete next[sampleId]; });
      return next;
    });
    if (foodType === type) setSelection('', null);
    onDeleteSuccess?.(`Deleted ${formatFoodTypeLabel(type)} data.`);
  };

  useEffect(() => {
    const handleDelete = (event: Event) => {
      const type = (event as CustomEvent<{ type?: string }>).detail?.type;
      if (!type) return;
      deleteImportedFoodTypeData(type);
    };

    window.addEventListener('sensory-food-type-delete', handleDelete);
    return () => window.removeEventListener('sensory-food-type-delete', handleDelete);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eTongueData, foodType]);

  return {
    selectedSamples: activeSelectedSamples,
    setSelectedSamples,
    eTongueData,
    setETongueData,
    gcmsData,
    setGcmsData,
    compositionData,
    setCompositionData,
    compareMode,
    setCompareMode,
    filteredETongueData,
    deleteImportedFoodTypeData,
  };
}

export function useInstrumentalChartViewModel({
  filteredETongueData,
  gcmsData,
  compositionData,
  selectedSamples,
  compareMode,
  foodType,
}: {
  filteredETongueData: ETongueMeasurement[];
  gcmsData: Record<string, GCMSCompound[]>;
  compositionData: Record<string, ChemicalComposition>;
  selectedSamples: string[];
  compareMode: boolean;
  foodType: string;
}) {
  const displayedSamples = useMemo(() => filteredETongueData.map((sample, index) => {
    const sampleInfo = SAMPLES.find(item => item.id === sample.sampleId);
    const type = sample.type || sampleInfo?.type || inferType(sample.sampleId);
    const category = sample.category || sampleInfo?.category || inferCategory(sample.sampleId, '', type);
    return {
      id: sample.sampleId,
      uniqueKey: `${sample.sampleId}-${index}`,
      name: sample.sampleName || sampleInfo?.name || sample.sampleId,
      category,
      type,
    };
  }), [filteredETongueData]);

  const pcaData = useMemo(() => filteredETongueData.map((sample, index) => {
    const pc1 = sample.saltiness * 0.5 + sample.umami * 0.4 - sample.sourness * 0.3;
    const pc2 = sample.bitterness * 0.4 + sample.sourness * 0.35 - sample.sweetness * 0.25;
    const sampleInfo = SAMPLES.find(item => item.id === sample.sampleId);
    const type = sample.type || sampleInfo?.type || inferType(sample.sampleId);
    const category = sample.category || sampleInfo?.category || inferCategory(sample.sampleId, '', type);
    return {
      id: `pca-${sample.sampleId}-${index}`,
      sampleId: sample.sampleId,
      uniqueKey: `${sample.sampleId}-${index}`,
      name: sample.sampleName || sampleInfo?.name || sample.sampleId,
      pc1: Number(pc1.toFixed(2)),
      pc2: Number(pc2.toFixed(2)),
      category,
      type,
    };
  }), [filteredETongueData]);

  const selectedSampleData = filteredETongueData.find(sample => sample.sampleId === selectedSamples[0]);
  const selectedGCMSData = gcmsData[selectedSamples[0]] || [];
  const selectedCompositionData = compositionData[selectedSamples[0]] || {};
  const selectedSampleInfo = displayedSamples.find(sample => sample.id === selectedSamples[0]);
  const selectedColor = getPointColor(selectedSampleInfo?.type, selectedSampleInfo?.category);
  const activeFoodTypeLabel = foodType === 'all' ? 'all sample types' : formatFoodTypeLabel(foodType);
  const toFivePointTaste = (value: number) => Math.max(0, Math.min(5, value));

  const radarData = selectedSampleData
    ? [
        { id: 'sourness', taste: 'Sourness', value: toFivePointTaste(selectedSampleData.sourness), fullMark: 5 },
        { id: 'bitterness', taste: 'Bitterness', value: toFivePointTaste(selectedSampleData.bitterness), fullMark: 5 },
        { id: 'saltiness', taste: 'Saltiness', value: toFivePointTaste(selectedSampleData.saltiness), fullMark: 5 },
        { id: 'umami', taste: 'Umami', value: toFivePointTaste(selectedSampleData.umami), fullMark: 5 },
        { id: 'sweetness', taste: 'Sweetness', value: toFivePointTaste(selectedSampleData.sweetness), fullMark: 5 },
      ]
    : [];

  const compareRadarSeries = compareMode
    ? selectedSamples
        .map((sampleId, index) => {
          const sample = filteredETongueData.find(item => item.sampleId === sampleId);
          if (!sample) return null;
          return {
            sampleId,
            name: displayedSamples.find(item => item.id === sampleId)?.name || sampleId,
            color: instrumentalComparisonColor(index),
            dataKey: `sample_${index}`,
            values: {
              Sourness: toFivePointTaste(sample.sourness),
              Bitterness: toFivePointTaste(sample.bitterness),
              Saltiness: toFivePointTaste(sample.saltiness),
              Umami: toFivePointTaste(sample.umami),
              Sweetness: toFivePointTaste(sample.sweetness),
            },
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
    : [];

  const compareRadarChartData = compareMode
    ? [
        { id: 'sourness', taste: 'Sourness', fullMark: 5 },
        { id: 'bitterness', taste: 'Bitterness', fullMark: 5 },
        { id: 'saltiness', taste: 'Saltiness', fullMark: 5 },
        { id: 'umami', taste: 'Umami', fullMark: 5 },
        { id: 'sweetness', taste: 'Sweetness', fullMark: 5 },
      ].map(row => {
        const nextRow: Record<string, string | number> = { ...row };
        compareRadarSeries.forEach(series => {
          nextRow[series.dataKey] = series.values[row.taste as keyof typeof series.values];
        });
        return nextRow;
      })
    : [];

  return {
    displayedSamples,
    pcaData,
    selectedSampleData,
    selectedGCMSData,
    selectedCompositionData,
    selectedColor,
    activeFoodTypeLabel,
    radarData,
    compareRadarSeries,
    compareRadarChartData,
  };
}

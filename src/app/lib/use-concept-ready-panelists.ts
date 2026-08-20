import { useQuery } from '@tanstack/react-query';
import { fetchConceptReadyPanelists } from './database';

export function useConceptReadyPanelists(enabled = true) {
  return useQuery({
    queryKey: ['conceptReadyPanelists'],
    queryFn: fetchConceptReadyPanelists,
    enabled,
  });
}

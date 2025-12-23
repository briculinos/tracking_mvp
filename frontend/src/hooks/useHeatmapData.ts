import { useQuery } from '@tanstack/react-query';
import { getHeatmap, getDwellTime } from '../services/api';
import type { HeatmapFilters, DwellTimeFilters, ViewMode } from '../types';

export function useHeatmapData(filters: HeatmapFilters | null, viewMode: ViewMode) {
  return useQuery({
    queryKey: ['heatmap', filters, viewMode],
    queryFn: async () => {
      if (!filters) return null;

      if (viewMode === 'tracks') {
        return getHeatmap(filters);
      } else {
        return getDwellTime(filters as DwellTimeFilters);
      }
    },
    enabled: !!filters && !!filters.store_id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

import { useQuery } from '@tanstack/react-query';
import { getStores, getFloorPlans, testConnection } from '../services/api';

export function useStores() {
  return useQuery({
    queryKey: ['stores'],
    queryFn: getStores,
  });
}

export function useFloorPlans(storeId: number | null) {
  return useQuery({
    queryKey: ['floorPlans', storeId],
    queryFn: () => getFloorPlans(storeId!),
    enabled: !!storeId,
    staleTime: Infinity, // Don't auto-refetch, we manually control when to refetch
    refetchOnWindowFocus: false,
  });
}

export function useConnectionTest() {
  return useQuery({
    queryKey: ['connectionTest'],
    queryFn: testConnection,
    retry: false,
  });
}

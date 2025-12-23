import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getZones,
  createZone,
  updateZone,
  deleteZone,
  getMultipleZoneStats,
} from '../services/api';
import type { ZoneCreate, Zone } from '../types';

export function useZones(storeId: number | null, floor?: number) {
  return useQuery({
    queryKey: ['zones', storeId, floor],
    queryFn: () => getZones(storeId!, floor),
    enabled: !!storeId,
  });
}

export function useCreateZone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (zone: ZoneCreate) => createZone(zone),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['zones', variables.store_id] });
    },
  });
}

export function useUpdateZone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ zoneId, updates }: { zoneId: number; updates: Partial<ZoneCreate> }) =>
      updateZone(zoneId, updates),
    onSuccess: (zone) => {
      queryClient.invalidateQueries({ queryKey: ['zones', zone.store_id] });
    },
  });
}

export function useDeleteZone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ zoneId }: { zoneId: number; storeId: number }) =>
      deleteZone(zoneId),
    onSuccess: (_, { storeId }) => {
      queryClient.invalidateQueries({ queryKey: ['zones', storeId] });
    },
  });
}

export function useZoneStats(
  storeId: number | null,
  zones: Zone[],
  startDate: string,
  endDate: string,
  startHour: number,
  endHour: number,
  includeDwell: boolean = false
) {
  const zoneIds = zones.map((z) => z.id);

  return useQuery({
    queryKey: ['zoneStats', storeId, zoneIds, startDate, endDate, startHour, endHour, includeDwell],
    queryFn: () =>
      getMultipleZoneStats(storeId!, zoneIds, startDate, endDate, startHour, endHour, includeDwell),
    enabled: !!storeId && zones.length > 0 && !!startDate && !!endDate,
    staleTime: 5 * 60 * 1000,
  });
}

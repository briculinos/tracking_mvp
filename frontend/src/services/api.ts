import axios from 'axios';
import type {
  Store,
  StoreListResponse,
  FloorPlan,
  FloorPlanCalibration,
  HeatmapResponse,
  HeatmapFilters,
  DwellTimeResponse,
  DwellTimeFilters,
  Zone,
  ZoneCreate,
  ZoneStats,
} from '../types';

const api = axios.create({
  baseURL: '/api',
});

// Stores
export const getStores = async (): Promise<Store[]> => {
  const { data } = await api.get<StoreListResponse>('/stores');
  return data.stores;
};

export const getStore = async (storeId: number): Promise<Store> => {
  const { data } = await api.get(`/stores/${storeId}`);
  return data;
};

export const getStoreFloors = async (storeId: number): Promise<number[]> => {
  const { data } = await api.get(`/stores/${storeId}/floors`);
  return data.floors;
};

export const testConnection = async (): Promise<unknown> => {
  const { data } = await api.get('/stores/test/connection');
  return data;
};

// Floor plans
export const getFloorPlans = async (storeId: number): Promise<FloorPlan[]> => {
  const { data } = await api.get(`/floorplans/store/${storeId}`);
  return data;
};

export const uploadFloorPlan = async (
  storeId: number,
  floor: number,
  file: File,
  calibration: FloorPlanCalibration
): Promise<FloorPlan> => {
  const formData = new FormData();
  formData.append('store_id', storeId.toString());
  formData.append('floor', floor.toString());
  formData.append('file', file);
  formData.append('data_min_x', calibration.data_min_x.toString());
  formData.append('data_max_x', calibration.data_max_x.toString());
  formData.append('data_min_y', calibration.data_min_y.toString());
  formData.append('data_max_y', calibration.data_max_y.toString());

  const { data } = await api.post('/floorplans/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const calibrateFloorPlan = async (
  floorPlanId: number,
  calibration: FloorPlanCalibration
): Promise<FloorPlan> => {
  const { data } = await api.put(`/floorplans/${floorPlanId}/calibrate`, calibration);
  return data;
};

export const adjustFloorPlan = async (
  floorPlanId: number,
  adjustment: {
    adjust_offset_x: number;
    adjust_offset_y: number;
    adjust_scale: number;
    adjust_scale_x: number;
    adjust_scale_y: number;
    adjust_rotation: number;
    affine_a?: number | null;
    affine_b?: number | null;
    affine_c?: number | null;
    affine_d?: number | null;
    affine_tx?: number | null;
    affine_ty?: number | null;
  }
): Promise<FloorPlan> => {
  const { data } = await api.put(`/floorplans/${floorPlanId}/adjust`, adjustment);
  return data;
};

export const deleteFloorPlan = async (floorPlanId: number): Promise<void> => {
  await api.delete(`/floorplans/${floorPlanId}`);
};

// Heatmap
export const getHeatmap = async (filters: HeatmapFilters): Promise<HeatmapResponse> => {
  const params = new URLSearchParams({
    floor: filters.floor.toString(),
    start_date: filters.start_date,
    end_date: filters.end_date,
    start_hour: filters.start_hour.toString(),
    end_hour: filters.end_hour.toString(),
  });

  if (filters.limit) {
    params.append('limit', filters.limit.toString());
  }

  const { data } = await api.get(`/heatmap/${filters.store_id}?${params}`);
  return data;
};

// Dwell time
export const getDwellTime = async (filters: DwellTimeFilters): Promise<DwellTimeResponse> => {
  const params = new URLSearchParams({
    floor: filters.floor.toString(),
    start_date: filters.start_date,
    end_date: filters.end_date,
    start_hour: filters.start_hour.toString(),
    end_hour: filters.end_hour.toString(),
  });

  if (filters.grid_size) {
    params.append('grid_size', filters.grid_size.toString());
  }
  if (filters.min_dwell_seconds) {
    params.append('min_dwell_seconds', filters.min_dwell_seconds.toString());
  }
  if (filters.max_dwell_seconds) {
    params.append('max_dwell_seconds', filters.max_dwell_seconds.toString());
  }

  const { data } = await api.get(`/dwell/${filters.store_id}?${params}`);
  return data;
};

// Zones
export const getZones = async (storeId: number, floor?: number): Promise<Zone[]> => {
  const params = floor !== undefined ? `?floor=${floor}` : '';
  const { data } = await api.get(`/zones/store/${storeId}${params}`);
  return data;
};

export const createZone = async (zone: ZoneCreate): Promise<Zone> => {
  const { data } = await api.post('/zones', zone);
  return data;
};

export const updateZone = async (
  zoneId: number,
  updates: Partial<ZoneCreate>
): Promise<Zone> => {
  const { data } = await api.put(`/zones/${zoneId}`, updates);
  return data;
};

export const deleteZone = async (zoneId: number): Promise<void> => {
  await api.delete(`/zones/${zoneId}`);
};

export const getZoneStats = async (
  zoneId: number,
  startDate: string,
  endDate: string,
  startHour: number = 0,
  endHour: number = 23,
  includeDwell: boolean = false
): Promise<ZoneStats> => {
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
    start_hour: startHour.toString(),
    end_hour: endHour.toString(),
    include_dwell: includeDwell.toString(),
  });

  const { data } = await api.get(`/zones/${zoneId}/stats?${params}`);
  return data;
};

export const getMultipleZoneStats = async (
  storeId: number,
  zoneIds: number[],
  startDate: string,
  endDate: string,
  startHour: number = 0,
  endHour: number = 23,
  includeDwell: boolean = false
): Promise<ZoneStats[]> => {
  const { data } = await api.post(`/zones/stats?include_dwell=${includeDwell}`, {
    store_id: storeId,
    zone_ids: zoneIds,
    start_date: startDate,
    end_date: endDate,
    start_hour: startHour,
    end_hour: endHour,
  });
  return data;
};

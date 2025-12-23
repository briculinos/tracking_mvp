// Store types
export interface Store {
  store_id: number;
  name: string;
  country: string;
  floors: number[];
}

export interface StoreListResponse {
  stores: Store[];
}

// Floor plan types
export interface FloorPlan {
  id: number;
  store_id: number;
  floor: number;
  filename: string;
  url: string;
  data_min_x: number;
  data_max_x: number;
  data_min_y: number;
  data_max_y: number;
  image_width: number;
  image_height: number;
  // Visual adjustments for floor plan overlay
  adjust_offset_x: number;  // percentage offset left/right
  adjust_offset_y: number;  // percentage offset up/down
  adjust_scale: number;     // scale factor (1.0 = 100%, uniform)
  adjust_scale_x: number;   // independent X scale
  adjust_scale_y: number;   // independent Y scale
  adjust_rotation: number;  // rotation degrees
  // Affine transform coefficients (from database)
  affine_a?: number | null;
  affine_b?: number | null;
  affine_c?: number | null;
  affine_d?: number | null;
  affine_tx?: number | null;
  affine_ty?: number | null;
  created_at: string;
}

export interface FloorPlanCalibration {
  data_min_x: number;
  data_max_x: number;
  data_min_y: number;
  data_max_y: number;
}

// Heatmap types
export interface RawPoint {
  x: number;
  y: number;
}

export interface HeatmapPoint {
  x: number;
  y: number;
  latitude: number;
  longitude: number;
  hash_id: string;
  timestamp: number;
  floor: number;
  uncertainty: number;
}

export interface HeatmapResponse {
  points: HeatmapPoint[];
  bounds: {
    min_x: number;
    max_x: number;
    min_y: number;
    max_y: number;
  };
  total_returned: number;
  total_in_database: number;
  total_unique_visitors?: number;  // Total unique hash_ids for entire floor
  total_visitor_days?: number;     // Accumulated visits (same person different days = multiple)
}

export interface HeatmapFilters {
  store_id: number;
  floor: number;
  start_date: string;
  end_date: string;
  start_hour: number;
  end_hour: number;
  limit?: number;
}

// Dwell time types
export interface DwellTimeCell {
  x: number;
  y: number;
  total_dwell_seconds: number;
  avg_dwell_seconds: number;
  visit_count: number;
  intensity?: number;
}

export interface DwellTimeResponse {
  cells: DwellTimeCell[];
  grid_size: number;
  bounds: {
    min_x: number;
    max_x: number;
    min_y: number;
    max_y: number;
  };
  total_dwell_time: number;
  avg_dwell_time: number;
}

export interface DwellTimeFilters extends HeatmapFilters {
  grid_size?: number;
  min_dwell_seconds?: number;
  max_dwell_seconds?: number;
}

// Zone types
export interface Zone {
  id: number;
  name: string;
  store_id: number;
  floor: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  created_at: string;
}

export interface ZoneCreate {
  name: string;
  store_id: number;
  floor: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface ZoneStats {
  zone_id: number;
  zone_name: string;
  track_count: number;
  unique_visitors: number;
  visitor_days: number;  // Accumulated visits (same person on different days counts multiple times)
  avg_dwell_seconds?: number;
}

// Calibration types
export interface CalibrationPoint {
  x: number;  // canvas x
  y: number;  // canvas y
}

export interface CalibrationState {
  isCalibrating: boolean;
  step: 'heatmap' | 'floorplan';  // which layer we're clicking
  heatmapPoints: CalibrationPoint[];  // points clicked on heatmap
  floorplanPoints: CalibrationPoint[];  // corresponding points on floorplan
}

// Affine transformation matrix coefficients
// Transforms point (x,y) to (a*x + b*y + tx, c*x + d*y + ty)
export interface AffineTransform {
  a: number;  // scale/rotate x component
  b: number;  // shear/rotate x component
  c: number;  // shear/rotate y component
  d: number;  // scale/rotate y component
  tx: number; // translate x
  ty: number; // translate y
}

// App state
export type ViewMode = 'tracks' | 'dwell';

export interface ScaleSettings {
  auto: boolean;
  min: number;
  max: number;
}

export interface FloorPlanAdjustment {
  offsetX: number;      // percentage to shift left (-) or right (+)
  offsetY: number;      // percentage to shift up (-) or down (+)
  rotation: number;     // degrees
  scale: number;        // 1.0 = 100% (uniform scale, kept for backward compat)
  scaleX: number;       // independent X scale (1.0 = 100%)
  scaleY: number;       // independent Y scale (1.0 = 100%)
  lockAspectRatio: boolean;  // when true, scaleX and scaleY move together
  useAffine?: boolean;  // when true, use affine transform instead of simple transform
  affine?: AffineTransform;  // affine transformation matrix
}

export interface AppFilters {
  storeId: number | null;
  floor: number;
  startDate: string;
  endDate: string;
  startHour: number;
  endHour: number;
  viewMode: ViewMode;
  minDwellSeconds: number;
  scaleSettings: ScaleSettings;
  floorPlanAdjustment: FloorPlanAdjustment;
}

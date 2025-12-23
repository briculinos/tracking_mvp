from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import Optional


# Store schemas
class Store(BaseModel):
    store_id: int
    name: str
    country: str
    floors: list[int] = []


class StoreListResponse(BaseModel):
    stores: list[Store]


# Floor plan schemas
class FloorPlan(BaseModel):
    id: int
    store_id: int
    floor: int
    filename: str
    url: str
    # Calibration: maps data coordinates to image pixels
    # data_min/max = coordinate bounds in meters
    # image_width/height = image dimensions in pixels
    data_min_x: float = 0.0
    data_max_x: float = 100.0
    data_min_y: float = 0.0
    data_max_y: float = 100.0
    image_width: int = 1000
    image_height: int = 1000
    # Visual adjustments for floor plan overlay
    adjust_offset_x: float = 0.0  # % offset left/right
    adjust_offset_y: float = 0.0  # % offset up/down
    adjust_scale: float = 1.0     # scale factor (uniform, for backward compat)
    adjust_scale_x: float = 1.0   # independent X scale
    adjust_scale_y: float = 1.0   # independent Y scale
    adjust_rotation: float = 0.0  # rotation degrees
    # Affine transform (when enabled, overrides simple adjustments)
    affine_a: Optional[float] = None
    affine_b: Optional[float] = None
    affine_c: Optional[float] = None
    affine_d: Optional[float] = None
    affine_tx: Optional[float] = None
    affine_ty: Optional[float] = None
    created_at: datetime


class FloorPlanCreate(BaseModel):
    store_id: int
    floor: int
    data_min_x: float = 0.0
    data_max_x: float = 100.0
    data_min_y: float = 0.0
    data_max_y: float = 100.0


class FloorPlanCalibration(BaseModel):
    data_min_x: float
    data_max_x: float
    data_min_y: float
    data_max_y: float


class FloorPlanAdjustment(BaseModel):
    adjust_offset_x: float = 0.0  # percentage offset left/right
    adjust_offset_y: float = 0.0  # percentage offset up/down
    adjust_scale: float = 1.0     # scale factor (1.0 = 100%, uniform)
    adjust_scale_x: float = 1.0   # independent X scale
    adjust_scale_y: float = 1.0   # independent Y scale
    adjust_rotation: float = 0.0  # rotation degrees
    # Affine transform coefficients (optional)
    affine_a: Optional[float] = None
    affine_b: Optional[float] = None
    affine_c: Optional[float] = None
    affine_d: Optional[float] = None
    affine_tx: Optional[float] = None
    affine_ty: Optional[float] = None


# Heatmap schemas
class HeatmapRequest(BaseModel):
    store_id: int
    floor: int = 0
    start_date: date
    end_date: date
    start_hour: int = Field(0, ge=0, le=23)
    end_hour: int = Field(23, ge=0, le=23)


class RawPoint(BaseModel):
    x: float  # latitude
    y: float  # longitude


class HeatmapResponse(BaseModel):
    points: list[RawPoint]
    bounds: dict  # {"min_x", "max_x", "min_y", "max_y"}
    total_returned: int


# Dwell time schemas
class DwellTimeRequest(BaseModel):
    store_id: int
    floor: int = 0
    start_date: date
    end_date: date
    start_hour: int = Field(0, ge=0, le=23)
    end_hour: int = Field(23, ge=0, le=23)
    min_dwell_seconds: int = 30
    max_dwell_seconds: Optional[int] = None
    grid_size: Optional[float] = None


class DwellTimeCell(BaseModel):
    x: float
    y: float
    total_dwell_seconds: int
    avg_dwell_seconds: float
    visit_count: int


class DwellTimeResponse(BaseModel):
    cells: list[DwellTimeCell]
    grid_size: float
    bounds: dict
    total_dwell_time: int
    avg_dwell_time: float


# Zone schemas
class ZoneBase(BaseModel):
    name: str
    store_id: int
    floor: int = 0
    x1: float  # top-left x
    y1: float  # top-left y
    x2: float  # bottom-right x
    y2: float  # bottom-right y


class ZoneCreate(ZoneBase):
    pass


class ZoneUpdate(BaseModel):
    name: Optional[str] = None
    x1: Optional[float] = None
    y1: Optional[float] = None
    x2: Optional[float] = None
    y2: Optional[float] = None


class Zone(ZoneBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ZoneStats(BaseModel):
    zone_id: int
    zone_name: str
    track_count: int
    unique_visitors: int
    visitor_days: int = 0  # Accumulated visits (same person different days = multiple)
    avg_dwell_seconds: Optional[float] = None


class ZoneStatsRequest(BaseModel):
    store_id: int
    zone_ids: list[int]
    start_date: date
    end_date: date
    start_hour: int = Field(0, ge=0, le=23)
    end_hour: int = Field(23, ge=0, le=23)


# Track data schema (raw)
class TrackPoint(BaseModel):
    hash_id: str
    latitude: float
    longitude: float
    timestamp: int
    floor: int
    uncertainty: int

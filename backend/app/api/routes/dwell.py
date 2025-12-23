from fastapi import APIRouter, Depends, Query
from datetime import date
from typing import Optional

from app.api.deps import BigQueryServiceDep, SettingsDep
from app.services.dwell_time import DwellTimeService
from app.models.schemas import DwellTimeRequest, DwellTimeResponse

router = APIRouter()


@router.get("/{store_id}")
async def get_dwell_heatmap(
    store_id: int,
    bq_service: BigQueryServiceDep,
    settings: SettingsDep,
    floor: int = Query(0, description="Floor number"),
    start_date: date = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: date = Query(..., description="End date (YYYY-MM-DD)"),
    start_hour: int = Query(0, ge=0, le=23, description="Start hour (0-23)"),
    end_hour: int = Query(23, ge=0, le=23, description="End hour (0-23)"),
    min_dwell_seconds: int = Query(30, description="Minimum dwell time in seconds"),
    max_dwell_seconds: Optional[int] = Query(None, description="Maximum dwell time in seconds"),
    grid_size: Optional[float] = Query(None, description="Grid cell size in meters")
):
    """
    Get dwell time heatmap for a store.

    Calculates time spent at each location and aggregates into grid cells.
    """
    dwell_service = DwellTimeService(bq_service, settings)

    data = await dwell_service.get_dwell_heatmap(
        store_id=store_id,
        floor=floor,
        start_date=start_date,
        end_date=end_date,
        start_hour=start_hour,
        end_hour=end_hour,
        min_dwell_seconds=min_dwell_seconds,
        max_dwell_seconds=max_dwell_seconds,
        grid_size=grid_size
    )

    # Add normalized intensity for visualization
    if data["cells"]:
        max_dwell = max(c["total_dwell_seconds"] for c in data["cells"])
        for cell in data["cells"]:
            cell["intensity"] = cell["total_dwell_seconds"] / max_dwell if max_dwell > 0 else 0

    return data


@router.post("/{store_id}")
async def get_dwell_heatmap_post(
    store_id: int,
    request: DwellTimeRequest,
    bq_service: BigQueryServiceDep,
    settings: SettingsDep
):
    """
    Get dwell time heatmap for a store (POST version).
    """
    dwell_service = DwellTimeService(bq_service, settings)

    data = await dwell_service.get_dwell_heatmap(
        store_id=store_id,
        floor=request.floor,
        start_date=request.start_date,
        end_date=request.end_date,
        start_hour=request.start_hour,
        end_hour=request.end_hour,
        min_dwell_seconds=request.min_dwell_seconds,
        max_dwell_seconds=request.max_dwell_seconds,
        grid_size=request.grid_size
    )

    # Add normalized intensity
    if data["cells"]:
        max_dwell = max(c["total_dwell_seconds"] for c in data["cells"])
        for cell in data["cells"]:
            cell["intensity"] = cell["total_dwell_seconds"] / max_dwell if max_dwell > 0 else 0

    return data

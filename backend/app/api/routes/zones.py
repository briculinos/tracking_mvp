from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import date
from typing import Optional

from app.api.deps import BigQueryServiceDep, SettingsDep
from app.models.database import get_db, ZoneModel
from app.models.schemas import Zone, ZoneCreate, ZoneUpdate, ZoneStats, ZoneStatsRequest
from app.services.zone_counter import ZoneCounterService

router = APIRouter()


@router.get("/store/{store_id}", response_model=list[Zone])
async def list_zones(
    store_id: int,
    floor: Optional[int] = Query(None, description="Filter by floor"),
    db: AsyncSession = Depends(get_db)
):
    """List all zones for a store"""
    query = select(ZoneModel).where(ZoneModel.store_id == store_id)
    if floor is not None:
        query = query.where(ZoneModel.floor == floor)

    result = await db.execute(query)
    zones = result.scalars().all()

    return [Zone.model_validate(z) for z in zones]


@router.get("/{zone_id}", response_model=Zone)
async def get_zone(
    zone_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific zone"""
    result = await db.execute(select(ZoneModel).where(ZoneModel.id == zone_id))
    zone = result.scalar_one_or_none()

    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")

    return Zone.model_validate(zone)


@router.post("", response_model=Zone)
async def create_zone(
    zone: ZoneCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new zone"""
    db_zone = ZoneModel(
        name=zone.name,
        store_id=zone.store_id,
        floor=zone.floor,
        x1=zone.x1,
        y1=zone.y1,
        x2=zone.x2,
        y2=zone.y2
    )

    db.add(db_zone)
    await db.commit()
    await db.refresh(db_zone)

    return Zone.model_validate(db_zone)


@router.put("/{zone_id}", response_model=Zone)
async def update_zone(
    zone_id: int,
    zone_update: ZoneUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update a zone"""
    result = await db.execute(select(ZoneModel).where(ZoneModel.id == zone_id))
    zone = result.scalar_one_or_none()

    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")

    if zone_update.name is not None:
        zone.name = zone_update.name
    if zone_update.x1 is not None:
        zone.x1 = zone_update.x1
    if zone_update.y1 is not None:
        zone.y1 = zone_update.y1
    if zone_update.x2 is not None:
        zone.x2 = zone_update.x2
    if zone_update.y2 is not None:
        zone.y2 = zone_update.y2

    await db.commit()
    await db.refresh(zone)

    return Zone.model_validate(zone)


@router.delete("/{zone_id}")
async def delete_zone(
    zone_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete a zone"""
    result = await db.execute(select(ZoneModel).where(ZoneModel.id == zone_id))
    zone = result.scalar_one_or_none()

    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")

    await db.delete(zone)
    await db.commit()

    return {"message": "Zone deleted", "zone_id": zone_id}


@router.get("/{zone_id}/stats", response_model=ZoneStats)
async def get_zone_stats(
    zone_id: int,
    bq_service: BigQueryServiceDep,
    settings: SettingsDep,
    start_date: date = Query(..., description="Start date"),
    end_date: date = Query(..., description="End date"),
    start_hour: int = Query(0, ge=0, le=23),
    end_hour: int = Query(23, ge=0, le=23),
    include_dwell: bool = Query(False, description="Include dwell time calculation"),
    db: AsyncSession = Depends(get_db)
):
    """Get visitor statistics for a zone"""
    # Get zone
    result = await db.execute(select(ZoneModel).where(ZoneModel.id == zone_id))
    zone = result.scalar_one_or_none()

    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")

    zone_counter = ZoneCounterService(bq_service, settings)

    stats = await zone_counter.get_zone_stats(
        store_id=zone.store_id,
        floor=zone.floor,
        zones=[{
            "id": zone.id,
            "name": zone.name,
            "x1": zone.x1,
            "y1": zone.y1,
            "x2": zone.x2,
            "y2": zone.y2
        }],
        start_date=start_date,
        end_date=end_date,
        start_hour=start_hour,
        end_hour=end_hour,
        include_dwell=include_dwell
    )

    return stats[0] if stats else ZoneStats(
        zone_id=zone_id,
        zone_name=zone.name,
        track_count=0,
        unique_visitors=0
    )


@router.post("/stats", response_model=list[ZoneStats])
async def get_multiple_zone_stats(
    request: ZoneStatsRequest,
    bq_service: BigQueryServiceDep,
    settings: SettingsDep,
    include_dwell: bool = Query(False),
    db: AsyncSession = Depends(get_db)
):
    """Get visitor statistics for multiple zones"""
    # Get zones
    result = await db.execute(
        select(ZoneModel).where(
            ZoneModel.store_id == request.store_id,
            ZoneModel.id.in_(request.zone_ids)
        )
    )
    zones = result.scalars().all()

    if not zones:
        return []

    zone_counter = ZoneCounterService(bq_service, settings)

    stats = await zone_counter.get_zone_stats(
        store_id=request.store_id,
        floor=zones[0].floor,  # Assuming all zones are on same floor
        zones=[{
            "id": z.id,
            "name": z.name,
            "x1": z.x1,
            "y1": z.y1,
            "x2": z.x2,
            "y2": z.y2
        } for z in zones],
        start_date=request.start_date,
        end_date=request.end_date,
        start_hour=request.start_hour,
        end_hour=request.end_hour,
        include_dwell=include_dwell
    )

    return stats


@router.get("/coverage/{store_id}")
async def get_zone_coverage(
    store_id: int,
    bq_service: BigQueryServiceDep,
    floor: int = Query(1),
    start_date: date = Query(...),
    end_date: date = Query(...),
    start_hour: int = Query(0, ge=0, le=23),
    end_hour: int = Query(23, ge=0, le=23),
    db: AsyncSession = Depends(get_db)
):
    """Check how many visitors are inside vs outside defined zones."""
    # Get zones for this store/floor
    result = await db.execute(
        select(ZoneModel).where(
            ZoneModel.store_id == store_id,
            ZoneModel.floor == floor
        )
    )
    zones = result.scalars().all()

    if not zones:
        return {"error": "No zones defined for this store/floor"}

    # Get coordinate offset
    from app.api.routes.heatmap import get_coordinate_offset
    offset_x, offset_y = await get_coordinate_offset(store_id, floor)

    coverage = await bq_service.get_visitors_outside_zones(
        store_id=store_id,
        floor=floor,
        zones=[{
            "x1": z.x1, "y1": z.y1,
            "x2": z.x2, "y2": z.y2
        } for z in zones],
        start_date=start_date,
        end_date=end_date,
        start_hour=start_hour,
        end_hour=end_hour,
        offset_x=offset_x,
        offset_y=offset_y
    )

    return {
        "total_visitors": coverage["total_visitors"],
        "visitors_in_zones": coverage["visitors_in_zones"],
        "visitors_outside_zones": coverage["visitors_outside_zones"],
        "zone_coverage_pct": round(coverage["visitors_in_zones"] / coverage["total_visitors"] * 100, 1) if coverage["total_visitors"] > 0 else 0
    }


@router.get("/completeness/{store_id}")
async def get_track_completeness(
    store_id: int,
    bq_service: BigQueryServiceDep,
    floor: int = Query(1),
    start_date: date = Query(...),
    end_date: date = Query(...),
    start_hour: int = Query(0, ge=0, le=23),
    end_hour: int = Query(23, ge=0, le=23),
    db: AsyncSession = Depends(get_db)
):
    """Get track completeness report - how many zones each visitor passed through."""
    # Get zones for this store/floor
    result = await db.execute(
        select(ZoneModel).where(
            ZoneModel.store_id == store_id,
            ZoneModel.floor == floor
        )
    )
    zones = result.scalars().all()

    if not zones:
        return {"error": "No zones defined for this store/floor"}

    # Get coordinate offset
    from app.api.routes.heatmap import get_coordinate_offset
    offset_x, offset_y = await get_coordinate_offset(store_id, floor)

    completeness = await bq_service.get_track_completeness(
        store_id=store_id,
        floor=floor,
        zones=[{
            "name": z.name,
            "x1": z.x1, "y1": z.y1,
            "x2": z.x2, "y2": z.y2
        } for z in zones],
        start_date=start_date,
        end_date=end_date,
        start_hour=start_hour,
        end_hour=end_hour,
        offset_x=offset_x,
        offset_y=offset_y
    )

    return completeness


@router.get("/quality/{zone_id}")
async def get_zone_track_quality(
    zone_id: int,
    bq_service: BigQueryServiceDep,
    start_date: date = Query(...),
    end_date: date = Query(...),
    start_hour: int = Query(0, ge=0, le=23),
    end_hour: int = Query(23, ge=0, le=23),
    db: AsyncSession = Depends(get_db)
):
    """
    Get track quality for a specific zone.
    Shows complete vs incomplete tracks (tracks that start/end inside zone without proper entry/exit).
    """
    result = await db.execute(select(ZoneModel).where(ZoneModel.id == zone_id))
    zone = result.scalar_one_or_none()

    if not zone:
        return {"error": "Zone not found"}

    # Get coordinate offset
    from app.api.routes.heatmap import get_coordinate_offset
    offset_x, offset_y = await get_coordinate_offset(zone.store_id, zone.floor)

    quality = await bq_service.get_zone_track_quality(
        store_id=zone.store_id,
        floor=zone.floor,
        zone={
            "name": zone.name,
            "x1": zone.x1, "y1": zone.y1,
            "x2": zone.x2, "y2": zone.y2
        },
        start_date=start_date,
        end_date=end_date,
        start_hour=start_hour,
        end_hour=end_hour,
        offset_x=offset_x,
        offset_y=offset_y
    )

    return quality

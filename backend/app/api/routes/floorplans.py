from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from PIL import Image
import aiofiles
import aiosqlite
import os
from datetime import datetime

from app.api.deps import SettingsDep
from app.models.database import get_db, FloorPlanModel
from app.models.schemas import FloorPlan, FloorPlanCreate, FloorPlanCalibration, FloorPlanAdjustment

router = APIRouter()

# Path to SQLite database for direct queries
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "tracking.db")


async def get_adjustments(store_id: int, floor: int) -> dict:
    """Get floor plan adjustments from database."""
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            cursor = await db.execute(
                """SELECT adjust_offset_x, adjust_offset_y, adjust_scale, adjust_rotation,
                          affine_a, affine_b, affine_c, affine_d, affine_tx, affine_ty,
                          adjust_scale_x, adjust_scale_y
                   FROM floorplans WHERE store_id = ? AND floor = ?""",
                (store_id, floor)
            )
            row = await cursor.fetchone()
            if row:
                return {
                    'adjust_offset_x': row[0] or 0.0,
                    'adjust_offset_y': row[1] or 0.0,
                    'adjust_scale': row[2] or 1.0,
                    'adjust_rotation': row[3] or 0.0,
                    'affine_a': row[4],
                    'affine_b': row[5],
                    'affine_c': row[6],
                    'affine_d': row[7],
                    'affine_tx': row[8],
                    'affine_ty': row[9],
                    'adjust_scale_x': row[10] or 1.0,
                    'adjust_scale_y': row[11] or 1.0,
                }
    except Exception:
        pass
    return {
        'adjust_offset_x': 0.0, 'adjust_offset_y': 0.0, 'adjust_scale': 1.0, 'adjust_rotation': 0.0,
        'adjust_scale_x': 1.0, 'adjust_scale_y': 1.0,
        'affine_a': None, 'affine_b': None, 'affine_c': None, 'affine_d': None, 'affine_tx': None, 'affine_ty': None
    }


@router.get("/store/{store_id}", response_model=list[FloorPlan])
async def list_floorplans(
    store_id: int,
    db: AsyncSession = Depends(get_db),
    settings: SettingsDep = None
):
    """List all floor plans for a store"""
    result = await db.execute(
        select(FloorPlanModel).where(FloorPlanModel.store_id == store_id)
    )
    floorplans = result.scalars().all()

    floor_plans_with_adjustments = []
    for fp in floorplans:
        # Get adjustments from direct DB query (columns may not be in ORM model yet)
        adjustments = await get_adjustments(fp.store_id, fp.floor)
        floor_plans_with_adjustments.append(
            FloorPlan(
                id=fp.id,
                store_id=fp.store_id,
                floor=fp.floor,
                filename=fp.filename,
                url=f"/uploads/floorplans/{fp.filename}",
                data_min_x=fp.data_min_x,
                data_max_x=fp.data_max_x,
                data_min_y=fp.data_min_y,
                data_max_y=fp.data_max_y,
                image_width=fp.image_width,
                image_height=fp.image_height,
                adjust_offset_x=adjustments['adjust_offset_x'],
                adjust_offset_y=adjustments['adjust_offset_y'],
                adjust_scale=adjustments['adjust_scale'],
                adjust_scale_x=adjustments['adjust_scale_x'],
                adjust_scale_y=adjustments['adjust_scale_y'],
                adjust_rotation=adjustments['adjust_rotation'],
                affine_a=adjustments['affine_a'],
                affine_b=adjustments['affine_b'],
                affine_c=adjustments['affine_c'],
                affine_d=adjustments['affine_d'],
                affine_tx=adjustments['affine_tx'],
                affine_ty=adjustments['affine_ty'],
                created_at=fp.created_at
            )
        )
    return floor_plans_with_adjustments


@router.get("/{floorplan_id}", response_model=FloorPlan)
async def get_floorplan(
    floorplan_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific floor plan"""
    result = await db.execute(
        select(FloorPlanModel).where(FloorPlanModel.id == floorplan_id)
    )
    fp = result.scalar_one_or_none()

    if not fp:
        raise HTTPException(status_code=404, detail="Floor plan not found")

    adjustments = await get_adjustments(fp.store_id, fp.floor)
    return FloorPlan(
        id=fp.id,
        store_id=fp.store_id,
        floor=fp.floor,
        filename=fp.filename,
        url=f"/uploads/floorplans/{fp.filename}",
        data_min_x=fp.data_min_x,
        data_max_x=fp.data_max_x,
        data_min_y=fp.data_min_y,
        data_max_y=fp.data_max_y,
        image_width=fp.image_width,
        image_height=fp.image_height,
        adjust_offset_x=adjustments['adjust_offset_x'],
        adjust_offset_y=adjustments['adjust_offset_y'],
        adjust_scale=adjustments['adjust_scale'],
        adjust_scale_x=adjustments['adjust_scale_x'],
        adjust_scale_y=adjustments['adjust_scale_y'],
        adjust_rotation=adjustments['adjust_rotation'],
        affine_a=adjustments['affine_a'],
        affine_b=adjustments['affine_b'],
        affine_c=adjustments['affine_c'],
        affine_d=adjustments['affine_d'],
        affine_tx=adjustments['affine_tx'],
        affine_ty=adjustments['affine_ty'],
        created_at=fp.created_at
    )


@router.post("/upload", response_model=FloorPlan)
async def upload_floorplan(
    store_id: int = Form(...),
    floor: int = Form(0),
    data_min_x: float = Form(0.0),
    data_max_x: float = Form(100.0),
    data_min_y: float = Form(0.0),
    data_max_y: float = Form(100.0),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    settings: SettingsDep = None
):
    """Upload a floor plan image"""
    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    # Generate filename
    ext = file.filename.split(".")[-1] if file.filename else "png"
    filename = f"store_{store_id}_floor_{floor}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{ext}"
    filepath = os.path.join(settings.floorplans_dir, filename)

    # Save file
    async with aiofiles.open(filepath, "wb") as f:
        content = await file.read()
        await f.write(content)

    # Get image dimensions
    with Image.open(filepath) as img:
        image_width, image_height = img.size

    # Check if floor plan already exists for this store/floor
    result = await db.execute(
        select(FloorPlanModel).where(
            FloorPlanModel.store_id == store_id,
            FloorPlanModel.floor == floor
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        # Delete old file
        old_filepath = os.path.join(settings.floorplans_dir, existing.filename)
        if os.path.exists(old_filepath):
            os.remove(old_filepath)

        # Update existing record
        existing.filename = filename
        existing.data_min_x = data_min_x
        existing.data_max_x = data_max_x
        existing.data_min_y = data_min_y
        existing.data_max_y = data_max_y
        existing.image_width = image_width
        existing.image_height = image_height
        fp = existing
    else:
        # Create new record
        fp = FloorPlanModel(
            store_id=store_id,
            floor=floor,
            filename=filename,
            data_min_x=data_min_x,
            data_max_x=data_max_x,
            data_min_y=data_min_y,
            data_max_y=data_max_y,
            image_width=image_width,
            image_height=image_height
        )
        db.add(fp)

    await db.commit()
    await db.refresh(fp)

    return FloorPlan(
        id=fp.id,
        store_id=fp.store_id,
        floor=fp.floor,
        filename=fp.filename,
        url=f"/uploads/floorplans/{fp.filename}",
        data_min_x=fp.data_min_x,
        data_max_x=fp.data_max_x,
        data_min_y=fp.data_min_y,
        data_max_y=fp.data_max_y,
        image_width=fp.image_width,
        image_height=fp.image_height,
        created_at=fp.created_at
    )


@router.put("/{floorplan_id}/calibrate", response_model=FloorPlan)
async def calibrate_floorplan(
    floorplan_id: int,
    calibration: FloorPlanCalibration,
    db: AsyncSession = Depends(get_db)
):
    """Update floor plan calibration (coordinate mapping)"""
    result = await db.execute(
        select(FloorPlanModel).where(FloorPlanModel.id == floorplan_id)
    )
    fp = result.scalar_one_or_none()

    if not fp:
        raise HTTPException(status_code=404, detail="Floor plan not found")

    fp.data_min_x = calibration.data_min_x
    fp.data_max_x = calibration.data_max_x
    fp.data_min_y = calibration.data_min_y
    fp.data_max_y = calibration.data_max_y

    await db.commit()
    await db.refresh(fp)

    adjustments = await get_adjustments(fp.store_id, fp.floor)
    return FloorPlan(
        id=fp.id,
        store_id=fp.store_id,
        floor=fp.floor,
        filename=fp.filename,
        url=f"/uploads/floorplans/{fp.filename}",
        data_min_x=fp.data_min_x,
        data_max_x=fp.data_max_x,
        data_min_y=fp.data_min_y,
        data_max_y=fp.data_max_y,
        image_width=fp.image_width,
        image_height=fp.image_height,
        adjust_offset_x=adjustments['adjust_offset_x'],
        adjust_offset_y=adjustments['adjust_offset_y'],
        adjust_scale=adjustments['adjust_scale'],
        adjust_scale_x=adjustments['adjust_scale_x'],
        adjust_scale_y=adjustments['adjust_scale_y'],
        adjust_rotation=adjustments['adjust_rotation'],
        affine_a=adjustments['affine_a'],
        affine_b=adjustments['affine_b'],
        affine_c=adjustments['affine_c'],
        affine_d=adjustments['affine_d'],
        affine_tx=adjustments['affine_tx'],
        affine_ty=adjustments['affine_ty'],
        created_at=fp.created_at
    )


@router.put("/{floorplan_id}/adjust", response_model=FloorPlan)
async def adjust_floorplan(
    floorplan_id: int,
    adjustment: FloorPlanAdjustment,
    db: AsyncSession = Depends(get_db)
):
    """Update floor plan visual adjustment (offset, scale, rotation, and affine transform)"""
    result = await db.execute(
        select(FloorPlanModel).where(FloorPlanModel.id == floorplan_id)
    )
    fp = result.scalar_one_or_none()

    if not fp:
        raise HTTPException(status_code=404, detail="Floor plan not found")

    # Update adjustments directly in database (columns may not be in ORM model yet)
    async with aiosqlite.connect(DB_PATH) as sdb:
        await sdb.execute(
            """UPDATE floorplans
               SET adjust_offset_x = ?, adjust_offset_y = ?, adjust_scale = ?, adjust_rotation = ?,
                   adjust_scale_x = ?, adjust_scale_y = ?,
                   affine_a = ?, affine_b = ?, affine_c = ?, affine_d = ?, affine_tx = ?, affine_ty = ?
               WHERE id = ?""",
            (adjustment.adjust_offset_x, adjustment.adjust_offset_y,
             adjustment.adjust_scale, adjustment.adjust_rotation,
             adjustment.adjust_scale_x, adjustment.adjust_scale_y,
             adjustment.affine_a, adjustment.affine_b, adjustment.affine_c,
             adjustment.affine_d, adjustment.affine_tx, adjustment.affine_ty,
             floorplan_id)
        )
        await sdb.commit()

    return FloorPlan(
        id=fp.id,
        store_id=fp.store_id,
        floor=fp.floor,
        filename=fp.filename,
        url=f"/uploads/floorplans/{fp.filename}",
        data_min_x=fp.data_min_x,
        data_max_x=fp.data_max_x,
        data_min_y=fp.data_min_y,
        data_max_y=fp.data_max_y,
        image_width=fp.image_width,
        image_height=fp.image_height,
        adjust_offset_x=adjustment.adjust_offset_x,
        adjust_offset_y=adjustment.adjust_offset_y,
        adjust_scale=adjustment.adjust_scale,
        adjust_scale_x=adjustment.adjust_scale_x,
        adjust_scale_y=adjustment.adjust_scale_y,
        adjust_rotation=adjustment.adjust_rotation,
        affine_a=adjustment.affine_a,
        affine_b=adjustment.affine_b,
        affine_c=adjustment.affine_c,
        affine_d=adjustment.affine_d,
        affine_tx=adjustment.affine_tx,
        affine_ty=adjustment.affine_ty,
        created_at=fp.created_at
    )


@router.delete("/{floorplan_id}")
async def delete_floorplan(
    floorplan_id: int,
    db: AsyncSession = Depends(get_db),
    settings: SettingsDep = None
):
    """Delete a floor plan"""
    result = await db.execute(
        select(FloorPlanModel).where(FloorPlanModel.id == floorplan_id)
    )
    fp = result.scalar_one_or_none()

    if not fp:
        raise HTTPException(status_code=404, detail="Floor plan not found")

    # Delete file
    filepath = os.path.join(settings.floorplans_dir, fp.filename)
    if os.path.exists(filepath):
        os.remove(filepath)

    await db.delete(fp)
    await db.commit()

    return {"message": "Floor plan deleted", "id": floorplan_id}

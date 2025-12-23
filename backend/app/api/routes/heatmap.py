from fastapi import APIRouter, Query
from datetime import date
import aiosqlite
import os

from app.api.deps import BigQueryServiceDep
from app.models.schemas import HeatmapRequest, HeatmapResponse

router = APIRouter()

# Database path
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "tracking.db")


async def get_coordinate_offset(store_id: int, floor: int) -> tuple[float, float]:
    """Get coordinate offset for a floor plan (to align tracking data with floor plan)."""
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            cursor = await db.execute(
                "SELECT offset_x, offset_y FROM floorplans WHERE store_id = ? AND floor = ?",
                (store_id, floor)
            )
            row = await cursor.fetchone()
            if row and row[0] is not None and row[1] is not None:
                return row[0], row[1]  # offset_x (longitude), offset_y (latitude)
    except Exception:
        pass
    return 0.0, 0.0


@router.get("/{store_id}")
async def get_heatmap(
    store_id: int,
    bq_service: BigQueryServiceDep,
    floor: int = Query(0, description="Floor number"),
    start_date: date = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: date = Query(..., description="End date (YYYY-MM-DD)"),
    start_hour: int = Query(0, ge=0, le=23, description="Start hour (0-23)"),
    end_hour: int = Query(23, ge=0, le=23, description="End hour (0-23)")
):
    """
    Get raw tracking points for heatmap visualization.

    Returns up to 250k sampled points for visualization.
    Zone calculations use ALL data from BigQuery (100% accurate).
    """
    points, total_count = await bq_service.get_raw_tracks(
        store_id=store_id,
        floor=floor,
        start_date=start_date,
        end_date=end_date,
        start_hour=start_hour,
        end_hour=end_hour,
        max_points=250000
    )

    # Get total unique visitors for the entire floor (no zone filtering)
    floor_totals = await bq_service.get_floor_totals(
        store_id=store_id,
        floor=floor,
        start_date=start_date,
        end_date=end_date,
        start_hour=start_hour,
        end_hour=end_hour
    )

    # Get coordinate offset to align tracking data with floor plan
    offset_x, offset_y = await get_coordinate_offset(store_id, floor)

    # Apply offset and compute bounds
    min_x, max_x = float('inf'), float('-inf')
    min_y, max_y = float('inf'), float('-inf')

    for point in points:
        # Apply offset: x = longitude, y = latitude
        point["x"] = point["longitude"] + offset_x
        point["y"] = point["latitude"] + offset_y
        min_x = min(min_x, point["x"])
        max_x = max(max_x, point["x"])
        min_y = min(min_y, point["y"])
        max_y = max(max_y, point["y"])

    return {
        "points": points,
        "bounds": {
            "min_x": min_x if points else 0,
            "max_x": max_x if points else 0,
            "min_y": min_y if points else 0,
            "max_y": max_y if points else 0
        },
        "total_returned": len(points),
        "total_in_database": total_count,
        "total_unique_visitors": floor_totals["unique_visitors"],
        "total_visitor_days": floor_totals["visitor_days"]  # Accumulated visits
    }


@router.get("/diagnostic/{store_id}")
async def get_data_diagnostic(
    store_id: int,
    bq_service: BigQueryServiceDep
):
    """
    Diagnostic endpoint to check BigQuery data quality.
    """
    from google.cloud.bigquery import QueryJobConfig, ScalarQueryParameter

    table_id = bq_service.table_id

    # Check overall data stats
    query = f"""
    SELECT
        store_id,
        floor,
        MIN(date) as min_date,
        MAX(date) as max_date,
        COUNT(*) as total_positions,
        COUNT(DISTINCT hash_id) as unique_visitors,
        COUNT(DISTINCT date) as days_with_data
    FROM `{table_id}`
    WHERE store_id = @store_id
    GROUP BY store_id, floor
    ORDER BY floor
    """

    job_config = QueryJobConfig(
        query_parameters=[
            ScalarQueryParameter("store_id", "INT64", store_id),
        ]
    )

    query_job = bq_service.client.query(query, job_config=job_config)
    results = list(query_job.result())

    floors_data = []
    for row in results:
        floors_data.append({
            "floor": row.floor,
            "date_range": f"{row.min_date} to {row.max_date}",
            "days_with_data": row.days_with_data,
            "total_positions": row.total_positions,
            "unique_visitors": row.unique_visitors,
            "avg_positions_per_visitor": round(row.total_positions / row.unique_visitors, 1) if row.unique_visitors > 0 else 0
        })

    # Check daily breakdown for November 2025
    daily_query = f"""
    SELECT
        date,
        COUNT(*) as positions,
        COUNT(DISTINCT hash_id) as visitors
    FROM `{table_id}`
    WHERE store_id = @store_id
        AND floor = 1
        AND date BETWEEN '2025-11-01' AND '2025-11-30'
    GROUP BY date
    ORDER BY date
    """

    daily_job = bq_service.client.query(daily_query, job_config=job_config)
    daily_results = list(daily_job.result())

    daily_data = []
    for row in daily_results:
        daily_data.append({
            "date": str(row.date),
            "positions": row.positions,
            "visitors": row.visitors
        })

    return {
        "store_id": store_id,
        "floors": floors_data,
        "daily_breakdown_floor1_nov2025": daily_data,
        "total_unique_visitors_all_floors": sum(f["unique_visitors"] for f in floors_data)
    }


@router.post("/{store_id}")
async def get_heatmap_post(
    store_id: int,
    request: HeatmapRequest,
    bq_service: BigQueryServiceDep
):
    """
    Get raw tracking points for heatmap visualization (POST version).
    """
    points, total_count = await bq_service.get_raw_tracks(
        store_id=store_id,
        floor=request.floor,
        start_date=request.start_date,
        end_date=request.end_date,
        start_hour=request.start_hour,
        end_hour=request.end_hour,
        max_points=250000
    )

    # Get coordinate offset to align tracking data with floor plan
    offset_x, offset_y = await get_coordinate_offset(store_id, request.floor)

    # Apply offset and compute bounds
    min_x, max_x = float('inf'), float('-inf')
    min_y, max_y = float('inf'), float('-inf')

    for point in points:
        point["x"] = point["longitude"] + offset_x
        point["y"] = point["latitude"] + offset_y
        min_x = min(min_x, point["x"])
        max_x = max(max_x, point["x"])
        min_y = min(min_y, point["y"])
        max_y = max(max_y, point["y"])

    return {
        "points": points,
        "bounds": {
            "min_x": min_x if points else 0,
            "max_x": max_x if points else 0,
            "min_y": min_y if points else 0,
            "max_y": max_y if points else 0
        },
        "total_returned": len(points),
        "total_in_database": total_count
    }

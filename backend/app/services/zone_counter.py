from datetime import date
from typing import Optional
import aiosqlite
import os

from app.services.bigquery import BigQueryService
from app.services.dwell_time import DwellTimeService
from app.config import Settings

# Database path for floor plan offsets
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "tracking.db")


async def get_coordinate_offset(store_id: int, floor: int) -> tuple[float, float]:
    """Get coordinate offset for a floor plan."""
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


class ZoneCounterService:
    def __init__(self, bq_service: BigQueryService, settings: Settings):
        self.bq_service = bq_service
        self.settings = settings
        self.dwell_service = DwellTimeService(bq_service, settings)

    async def get_zone_stats(
        self,
        store_id: int,
        floor: int,
        zones: list[dict],
        start_date: date,
        end_date: date,
        start_hour: int = 0,
        end_hour: int = 23,
        include_dwell: bool = False
    ) -> list[dict]:
        """Get visitor statistics for specified zones"""
        # Get coordinate offset for this floor plan
        offset_x, offset_y = await get_coordinate_offset(store_id, floor)

        # Get basic stats from BigQuery (pass offset to subtract from zone coords)
        stats = await self.bq_service.get_zone_stats(
            store_id=store_id,
            floor=floor,
            zones=zones,
            start_date=start_date,
            end_date=end_date,
            start_hour=start_hour,
            end_hour=end_hour,
            offset_x=offset_x,
            offset_y=offset_y
        )

        if include_dwell:
            # Calculate dwell time for each zone
            # This is more expensive, so it's optional
            dwell_data = await self.dwell_service.get_dwell_heatmap(
                store_id=store_id,
                floor=floor,
                start_date=start_date,
                end_date=end_date,
                start_hour=start_hour,
                end_hour=end_hour
            )

            # Calculate average dwell per zone
            # Note: dwell cells have offset applied, so zone coords need offset too
            for stat in stats:
                zone = next((z for z in zones if z["id"] == stat["zone_id"]), None)
                if zone:
                    # Apply offset to zone coordinates to match dwell cell coordinates
                    zone_x1 = zone["x1"] + offset_x
                    zone_x2 = zone["x2"] + offset_x
                    zone_y1 = zone["y1"] + offset_y
                    zone_y2 = zone["y2"] + offset_y

                    zone_dwell = [
                        c for c in dwell_data["cells"]
                        if (min(zone_x1, zone_x2) <= c["x"] <= max(zone_x1, zone_x2) and
                            min(zone_y1, zone_y2) <= c["y"] <= max(zone_y1, zone_y2))
                    ]
                    if zone_dwell:
                        total_dwell = sum(c["total_dwell_seconds"] for c in zone_dwell)
                        total_visits = sum(c["visit_count"] for c in zone_dwell)
                        stat["avg_dwell_seconds"] = total_dwell / total_visits if total_visits > 0 else 0
                    else:
                        stat["avg_dwell_seconds"] = 0

        return stats

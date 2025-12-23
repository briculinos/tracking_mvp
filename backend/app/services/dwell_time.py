from datetime import date
from typing import Optional
from collections import defaultdict
import math
import aiosqlite
import os

from app.services.bigquery import BigQueryService
from app.config import Settings

# Database path
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "tracking.db")


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


class DwellTimeService:
    def __init__(self, bq_service: BigQueryService, settings: Settings):
        self.bq_service = bq_service
        self.settings = settings

    def _distance_meters(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate approximate distance in meters between two GPS points"""
        # At latitude ~55.5: 1 degree lat ≈ 111km, 1 degree lon ≈ 62km
        lat_diff_m = (lat2 - lat1) * 111000
        lon_diff_m = (lon2 - lon1) * 111000 * 0.566  # cos(55.5°) ≈ 0.566
        return math.sqrt(lat_diff_m ** 2 + lon_diff_m ** 2)

    def _calculate_dwell_times(
        self,
        tracks: list[dict],
        spatial_threshold: float,
        min_dwell_time: int
    ) -> list[dict]:
        """
        Calculate dwell times from raw track data.

        Algorithm:
        1. Group tracks by hash_id (visitor)
        2. For each visitor, identify stationary periods
        3. A stationary period is consecutive points within spatial_threshold
        4. Return dwell locations with duration
        """
        # Group by visitor
        visitor_tracks = defaultdict(list)
        for track in tracks:
            visitor_tracks[track["hash_id"]].append(track)

        dwell_events = []

        for hash_id, points in visitor_tracks.items():
            # Sort by timestamp
            points = sorted(points, key=lambda x: x["timestamp"])

            if len(points) < 2:
                continue

            # Find stationary periods
            i = 0
            while i < len(points):
                start_point = points[i]
                start_time = start_point["timestamp"]
                centroid_lat = start_point["latitude"]
                centroid_lon = start_point["longitude"]
                count = 1

                # Expand cluster while points are within threshold
                j = i + 1
                while j < len(points):
                    point = points[j]
                    dist = self._distance_meters(
                        centroid_lat, centroid_lon,
                        point["latitude"], point["longitude"]
                    )

                    if dist <= spatial_threshold:
                        # Update centroid
                        centroid_lat = (centroid_lat * count + point["latitude"]) / (count + 1)
                        centroid_lon = (centroid_lon * count + point["longitude"]) / (count + 1)
                        count += 1
                        j += 1
                    else:
                        break

                end_time = points[j - 1]["timestamp"]
                dwell_duration = end_time - start_time

                # Cap dwell duration at 30 minutes (1800s) to filter out staff/outliers
                MAX_DWELL_SECONDS = 1800
                if dwell_duration >= min_dwell_time:
                    dwell_events.append({
                        "hash_id": hash_id,
                        # x = longitude (horizontal), y = latitude (vertical)
                        "x": centroid_lon,
                        "y": centroid_lat,
                        "duration": min(dwell_duration, MAX_DWELL_SECONDS),
                        "start_time": start_time,
                        "end_time": end_time
                    })

                i = j

        return dwell_events

    def _aggregate_dwell_to_grid(
        self,
        dwell_events: list[dict],
        grid_size: float
    ) -> dict:
        """Aggregate dwell events to grid cells"""
        # Convert grid_size from meters to degrees
        lat_grid = grid_size / 111000.0
        lon_grid = grid_size / (111000.0 * 0.566)  # cos(55.5°)

        grid_cells = defaultdict(lambda: {
            "total_dwell": 0,
            "visit_count": 0,
            "visitors": set()
        })

        for event in dwell_events:
            # Snap to grid: x=longitude, y=latitude
            grid_x = math.floor(event["x"] / lon_grid) * lon_grid + (lon_grid / 2)
            grid_y = math.floor(event["y"] / lat_grid) * lat_grid + (lat_grid / 2)
            key = (grid_x, grid_y)

            grid_cells[key]["total_dwell"] += event["duration"]
            grid_cells[key]["visit_count"] += 1
            grid_cells[key]["visitors"].add(event["hash_id"])

        # Convert to list format
        cells = []
        min_x, max_x = float('inf'), float('-inf')
        min_y, max_y = float('inf'), float('-inf')
        total_dwell = 0

        for (x, y), data in grid_cells.items():
            avg_dwell = data["total_dwell"] / data["visit_count"] if data["visit_count"] > 0 else 0
            cells.append({
                "x": x,
                "y": y,
                "total_dwell_seconds": data["total_dwell"],
                "avg_dwell_seconds": avg_dwell,
                "visit_count": data["visit_count"],
                "unique_visitors": len(data["visitors"])
            })
            min_x = min(min_x, x)
            max_x = max(max_x, x)
            min_y = min(min_y, y)
            max_y = max(max_y, y)
            total_dwell += data["total_dwell"]

        total_visits = sum(c["visit_count"] for c in cells)
        avg_dwell = total_dwell / total_visits if total_visits > 0 else 0

        return {
            "cells": cells,
            "bounds": {
                "min_x": min_x if cells else 0,
                "max_x": max_x if cells else 0,
                "min_y": min_y if cells else 0,
                "max_y": max_y if cells else 0
            },
            "total_dwell_time": total_dwell,
            "avg_dwell_time": avg_dwell
        }

    async def get_dwell_heatmap(
        self,
        store_id: int,
        floor: int,
        start_date: date,
        end_date: date,
        start_hour: int = 0,
        end_hour: int = 23,
        min_dwell_seconds: int = 30,
        max_dwell_seconds: Optional[int] = None,
        grid_size: Optional[float] = None
    ) -> dict:
        """Get dwell time heatmap data"""
        grid_size = grid_size or self.settings.heatmap_grid_size
        spatial_threshold = self.settings.dwell_spatial_threshold

        # Get raw tracks (returns tuple of tracks, total_count)
        tracks, _ = await self.bq_service.get_raw_tracks(
            store_id=store_id,
            floor=floor,
            start_date=start_date,
            end_date=end_date,
            start_hour=start_hour,
            end_hour=end_hour
        )

        # Calculate dwell times
        dwell_events = self._calculate_dwell_times(
            tracks=tracks,
            spatial_threshold=spatial_threshold,
            min_dwell_time=min_dwell_seconds
        )

        # Filter by max dwell time if specified
        if max_dwell_seconds:
            dwell_events = [e for e in dwell_events if e["duration"] <= max_dwell_seconds]

        # Get coordinate offset to align with floor plan
        offset_x, offset_y = await get_coordinate_offset(store_id, floor)

        # Apply offset to dwell events before aggregation
        for event in dwell_events:
            event["x"] += offset_x
            event["y"] += offset_y

        # Aggregate to grid
        result = self._aggregate_dwell_to_grid(dwell_events, grid_size)
        result["grid_size"] = grid_size

        return result

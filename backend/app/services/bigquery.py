from google.cloud import bigquery
from google.cloud.bigquery import QueryJobConfig, ScalarQueryParameter
from datetime import date
from typing import Optional
import logging

from app.config import Settings

logger = logging.getLogger(__name__)


class BigQueryService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.client = bigquery.Client(project=settings.gcp_project_id)
        self.table_id = settings.bq_full_table_id

    async def get_stores(self) -> list[dict]:
        """Get distinct stores from tracking data"""
        query = f"""
        SELECT DISTINCT store_id
        FROM `{self.table_id}`
        ORDER BY store_id
        """
        try:
            query_job = self.client.query(query)
            results = query_job.result()
            return [{"store_id": row.store_id} for row in results]
        except Exception as e:
            logger.error(f"Error fetching stores: {e}")
            raise

    async def get_store_floors(self, store_id: int) -> list[int]:
        """Get distinct floors for a store"""
        query = f"""
        SELECT DISTINCT floor
        FROM `{self.table_id}`
        WHERE store_id = @store_id
        ORDER BY floor
        """
        job_config = QueryJobConfig(
            query_parameters=[
                ScalarQueryParameter("store_id", "INT64", store_id)
            ]
        )
        try:
            query_job = self.client.query(query, job_config=job_config)
            results = query_job.result()
            return [row.floor for row in results]
        except Exception as e:
            logger.error(f"Error fetching floors: {e}")
            raise

    async def get_heatmap_data(
        self,
        store_id: int,
        floor: int,
        start_date: date,
        end_date: date,
        start_hour: int,
        end_hour: int,
        grid_size: float
    ) -> dict:
        """Get aggregated heatmap data using grid binning"""
        query = f"""
        WITH grid_data AS (
            SELECT
                FLOOR(latitude / @grid_size) * @grid_size + (@grid_size / 2) as x,
                FLOOR(longitude / @grid_size) * @grid_size + (@grid_size / 2) as y,
                COUNT(*) as track_count,
                COUNT(DISTINCT hash_id) as unique_visitors
            FROM `{self.table_id}`
            WHERE store_id = @store_id
                AND floor = @floor
                AND date BETWEEN @start_date AND @end_date
                AND EXTRACT(HOUR FROM TIMESTAMP_SECONDS(timestamp)) BETWEEN @start_hour AND @end_hour
            GROUP BY x, y
        ),
        bounds AS (
            SELECT
                MIN(latitude) as min_x,
                MAX(latitude) as max_x,
                MIN(longitude) as min_y,
                MAX(longitude) as max_y,
                SUM(track_count) as total_tracks,
                SUM(unique_visitors) as total_visitors
            FROM grid_data
            CROSS JOIN (
                SELECT latitude, longitude
                FROM `{self.table_id}`
                WHERE store_id = @store_id AND floor = @floor
            )
        )
        SELECT
            x, y, track_count, unique_visitors
        FROM grid_data
        ORDER BY track_count DESC
        """

        # Convert grid_size from meters to degrees
        # At latitude ~55: 1 degree lat ≈ 111km, 1 degree lon ≈ 62km
        # cos(55.5°) ≈ 0.566
        simple_query = f"""
        WITH params AS (
            SELECT
                @grid_size / 111000.0 as lat_grid,
                @grid_size / (111000.0 * 0.566) as lon_grid
        )
        SELECT
            FLOOR(latitude / p.lat_grid) * p.lat_grid + (p.lat_grid / 2) as x,
            FLOOR(longitude / p.lon_grid) * p.lon_grid + (p.lon_grid / 2) as y,
            COUNT(*) as track_count,
            COUNT(DISTINCT hash_id) as unique_visitors
        FROM `{self.table_id}`, params p
        WHERE store_id = @store_id
            AND floor = @floor
            AND date BETWEEN @start_date AND @end_date
            AND EXTRACT(HOUR FROM TIMESTAMP_SECONDS(timestamp)) BETWEEN @start_hour AND @end_hour
        GROUP BY x, y
        ORDER BY track_count DESC
        """

        job_config = QueryJobConfig(
            query_parameters=[
                ScalarQueryParameter("store_id", "INT64", store_id),
                ScalarQueryParameter("floor", "INT64", floor),
                ScalarQueryParameter("start_date", "DATE", start_date),
                ScalarQueryParameter("end_date", "DATE", end_date),
                ScalarQueryParameter("start_hour", "INT64", start_hour),
                ScalarQueryParameter("end_hour", "INT64", end_hour),
                ScalarQueryParameter("grid_size", "FLOAT64", grid_size),
            ]
        )

        try:
            query_job = self.client.query(simple_query, job_config=job_config)
            results = list(query_job.result())

            cells = []
            min_x, max_x = float('inf'), float('-inf')
            min_y, max_y = float('inf'), float('-inf')
            total_tracks = 0
            unique_visitors_set = set()

            for row in results:
                cells.append({
                    "x": row.x,
                    "y": row.y,
                    "track_count": row.track_count,
                    "unique_visitors": row.unique_visitors
                })
                min_x = min(min_x, row.x)
                max_x = max(max_x, row.x)
                min_y = min(min_y, row.y)
                max_y = max(max_y, row.y)
                total_tracks += row.track_count

            return {
                "cells": cells,
                "grid_size": grid_size,
                "bounds": {
                    "min_x": min_x if cells else 0,
                    "max_x": max_x if cells else 0,
                    "min_y": min_y if cells else 0,
                    "max_y": max_y if cells else 0
                },
                "total_tracks": total_tracks,
                "total_unique_visitors": len(set(c["unique_visitors"] for c in cells)) if cells else 0
            }
        except Exception as e:
            logger.error(f"Error fetching heatmap data: {e}")
            raise

    async def get_raw_tracks(
        self,
        store_id: int,
        floor: int,
        start_date: date,
        end_date: date,
        start_hour: int,
        end_hour: int,
        max_points: int = 200000
    ) -> tuple[list[dict], int]:
        """Get raw track points with random sampling for large datasets.

        Args:
            max_points: Maximum points to return. Uses random sampling if data exceeds this.

        Returns:
            Tuple of (points list, total_count in database)
        """
        # First, get the total count
        count_query = f"""
        SELECT COUNT(*) as total
        FROM `{self.table_id}`
        WHERE store_id = @store_id
            AND floor = @floor
            AND date BETWEEN @start_date AND @end_date
            AND EXTRACT(HOUR FROM TIMESTAMP_SECONDS(timestamp)) BETWEEN @start_hour AND @end_hour
        """

        job_config = QueryJobConfig(
            query_parameters=[
                ScalarQueryParameter("store_id", "INT64", store_id),
                ScalarQueryParameter("floor", "INT64", floor),
                ScalarQueryParameter("start_date", "DATE", start_date),
                ScalarQueryParameter("end_date", "DATE", end_date),
                ScalarQueryParameter("start_hour", "INT64", start_hour),
                ScalarQueryParameter("end_hour", "INT64", end_hour),
            ]
        )

        count_job = self.client.query(count_query, job_config=job_config)
        total_count = list(count_job.result())[0].total

        # Calculate sampling rate if needed
        if total_count > max_points:
            sample_rate = max_points / total_count
            # Use random sampling
            query = f"""
            SELECT
                hash_id,
                latitude,
                longitude,
                timestamp,
                floor,
                uncertainty
            FROM `{self.table_id}`
            WHERE store_id = @store_id
                AND floor = @floor
                AND date BETWEEN @start_date AND @end_date
                AND EXTRACT(HOUR FROM TIMESTAMP_SECONDS(timestamp)) BETWEEN @start_hour AND @end_hour
                AND RAND() < @sample_rate
            """
            job_config = QueryJobConfig(
                query_parameters=[
                    ScalarQueryParameter("store_id", "INT64", store_id),
                    ScalarQueryParameter("floor", "INT64", floor),
                    ScalarQueryParameter("start_date", "DATE", start_date),
                    ScalarQueryParameter("end_date", "DATE", end_date),
                    ScalarQueryParameter("start_hour", "INT64", start_hour),
                    ScalarQueryParameter("end_hour", "INT64", end_hour),
                    ScalarQueryParameter("sample_rate", "FLOAT64", sample_rate * 1.1),  # slightly over to ensure enough
                ]
            )
        else:
            # Fetch all data
            query = f"""
            SELECT
                hash_id,
                latitude,
                longitude,
                timestamp,
                floor,
                uncertainty
            FROM `{self.table_id}`
            WHERE store_id = @store_id
                AND floor = @floor
                AND date BETWEEN @start_date AND @end_date
                AND EXTRACT(HOUR FROM TIMESTAMP_SECONDS(timestamp)) BETWEEN @start_hour AND @end_hour
            """

        try:
            query_job = self.client.query(query, job_config=job_config)
            results = query_job.result()
            points = [
                {
                    "hash_id": row.hash_id,
                    "latitude": row.latitude,
                    "longitude": row.longitude,
                    "timestamp": row.timestamp,
                    "floor": row.floor,
                    "uncertainty": row.uncertainty
                }
                for row in results
            ]
            return points, total_count
        except Exception as e:
            logger.error(f"Error fetching raw tracks: {e}")
            raise

    async def get_aggregated_heatmap(
        self,
        store_id: int,
        floor: int,
        start_date: date,
        end_date: date,
        start_hour: int,
        end_hour: int,
        bin_size: float = 0.000005  # ~0.5 meters in lat/lon for finer resolution
    ) -> tuple[list[dict], int]:
        """Get aggregated heatmap data with spatial binning.

        Aggregates all points into spatial bins for accurate density visualization.
        No sampling - uses all data points.

        Args:
            bin_size: Size of spatial bins in degrees (~0.000025 = 2.75 meters)

        Returns:
            Tuple of (bins list with counts, total_point_count)
        """
        query = f"""
        SELECT
            ROUND(longitude / @bin_size) * @bin_size as bin_x,
            ROUND(latitude / @bin_size) * @bin_size as bin_y,
            COUNT(*) as count,
            COUNT(DISTINCT hash_id) as unique_visitors
        FROM `{self.table_id}`
        WHERE store_id = @store_id
            AND floor = @floor
            AND date BETWEEN @start_date AND @end_date
            AND EXTRACT(HOUR FROM TIMESTAMP_SECONDS(timestamp)) BETWEEN @start_hour AND @end_hour
        GROUP BY bin_x, bin_y
        """

        job_config = QueryJobConfig(
            query_parameters=[
                ScalarQueryParameter("store_id", "INT64", store_id),
                ScalarQueryParameter("floor", "INT64", floor),
                ScalarQueryParameter("start_date", "DATE", start_date),
                ScalarQueryParameter("end_date", "DATE", end_date),
                ScalarQueryParameter("start_hour", "INT64", start_hour),
                ScalarQueryParameter("end_hour", "INT64", end_hour),
                ScalarQueryParameter("bin_size", "FLOAT64", bin_size),
            ]
        )

        try:
            query_job = self.client.query(query, job_config=job_config)
            results = query_job.result()

            bins = []
            total_points = 0
            for row in results:
                bins.append({
                    "x": row.bin_x,
                    "y": row.bin_y,
                    "count": row.count,
                    "unique_visitors": row.unique_visitors
                })
                total_points += row.count

            return bins, total_points
        except Exception as e:
            logger.error(f"Error fetching aggregated heatmap: {e}")
            raise

    async def get_zone_stats(
        self,
        store_id: int,
        floor: int,
        zones: list[dict],  # [{"id": 1, "x1": 0, "y1": 0, "x2": 10, "y2": 10}, ...]
        start_date: date,
        end_date: date,
        start_hour: int,
        end_hour: int,
        offset_x: float = 0.0,  # Coordinate offset to subtract (x = longitude)
        offset_y: float = 0.0   # Coordinate offset to subtract (y = latitude)
    ) -> list[dict]:
        """Get visitor counts for specified zones.

        Zone coordinates are in data space (x=longitude+offset, y=latitude+offset).
        We need to subtract the offset to query raw lat/lon in BigQuery.
        Note: x corresponds to longitude, y corresponds to latitude.
        """
        results = []

        for zone in zones:
            # Zone coords are in data space with offset applied
            # Subtract offset to get raw lat/lon for BigQuery
            # x = longitude, y = latitude
            lon_min = min(zone["x1"], zone["x2"]) - offset_x
            lon_max = max(zone["x1"], zone["x2"]) - offset_x
            lat_min = min(zone["y1"], zone["y2"]) - offset_y
            lat_max = max(zone["y1"], zone["y2"]) - offset_y

            query = f"""
            SELECT
                COUNT(*) as track_count,
                COUNT(DISTINCT hash_id) as unique_visitors,
                COUNT(DISTINCT CONCAT(hash_id, '-', CAST(date AS STRING))) as visitor_days
            FROM `{self.table_id}`
            WHERE store_id = @store_id
                AND floor = @floor
                AND date BETWEEN @start_date AND @end_date
                AND EXTRACT(HOUR FROM TIMESTAMP_SECONDS(timestamp)) BETWEEN @start_hour AND @end_hour
                AND longitude BETWEEN @lon_min AND @lon_max
                AND latitude BETWEEN @lat_min AND @lat_max
            """

            job_config = QueryJobConfig(
                query_parameters=[
                    ScalarQueryParameter("store_id", "INT64", store_id),
                    ScalarQueryParameter("floor", "INT64", floor),
                    ScalarQueryParameter("start_date", "DATE", start_date),
                    ScalarQueryParameter("end_date", "DATE", end_date),
                    ScalarQueryParameter("start_hour", "INT64", start_hour),
                    ScalarQueryParameter("end_hour", "INT64", end_hour),
                    ScalarQueryParameter("lon_min", "FLOAT64", lon_min),
                    ScalarQueryParameter("lon_max", "FLOAT64", lon_max),
                    ScalarQueryParameter("lat_min", "FLOAT64", lat_min),
                    ScalarQueryParameter("lat_max", "FLOAT64", lat_max),
                ]
            )

            try:
                query_job = self.client.query(query, job_config=job_config)
                row = list(query_job.result())[0]
                results.append({
                    "zone_id": zone["id"],
                    "zone_name": zone.get("name", f"Zone {zone['id']}"),
                    "track_count": row.track_count,
                    "unique_visitors": row.unique_visitors,
                    "visitor_days": row.visitor_days  # Accumulated visits (same person on different days counts multiple times)
                })
            except Exception as e:
                logger.error(f"Error fetching zone stats for zone {zone['id']}: {e}")
                results.append({
                    "zone_id": zone["id"],
                    "zone_name": zone.get("name", f"Zone {zone['id']}"),
                    "track_count": 0,
                    "unique_visitors": 0,
                    "visitor_days": 0,
                    "error": str(e)
                })

        return results

    async def get_visitors_outside_zones(
        self,
        store_id: int,
        floor: int,
        zones: list[dict],
        start_date: date,
        end_date: date,
        start_hour: int,
        end_hour: int,
        offset_x: float = 0.0,
        offset_y: float = 0.0
    ) -> dict:
        """Get unique visitors that are NOT in any of the specified zones."""

        # Build zone exclusion conditions
        zone_conditions = []
        for zone in zones:
            lon_min = min(zone["x1"], zone["x2"]) - offset_x
            lon_max = max(zone["x1"], zone["x2"]) - offset_x
            lat_min = min(zone["y1"], zone["y2"]) - offset_y
            lat_max = max(zone["y1"], zone["y2"]) - offset_y
            zone_conditions.append(
                f"(longitude BETWEEN {lon_min} AND {lon_max} AND latitude BETWEEN {lat_min} AND {lat_max})"
            )

        # Visitors in ANY zone
        in_zones_condition = " OR ".join(zone_conditions) if zone_conditions else "FALSE"

        query = f"""
        WITH all_visitors AS (
            SELECT DISTINCT hash_id
            FROM `{self.table_id}`
            WHERE store_id = @store_id
                AND floor = @floor
                AND date BETWEEN @start_date AND @end_date
                AND EXTRACT(HOUR FROM TIMESTAMP_SECONDS(timestamp)) BETWEEN @start_hour AND @end_hour
        ),
        visitors_in_zones AS (
            SELECT DISTINCT hash_id
            FROM `{self.table_id}`
            WHERE store_id = @store_id
                AND floor = @floor
                AND date BETWEEN @start_date AND @end_date
                AND EXTRACT(HOUR FROM TIMESTAMP_SECONDS(timestamp)) BETWEEN @start_hour AND @end_hour
                AND ({in_zones_condition})
        )
        SELECT
            (SELECT COUNT(*) FROM all_visitors) as total_visitors,
            (SELECT COUNT(*) FROM visitors_in_zones) as visitors_in_zones,
            (SELECT COUNT(*) FROM all_visitors WHERE hash_id NOT IN (SELECT hash_id FROM visitors_in_zones)) as visitors_outside_zones
        """

        job_config = QueryJobConfig(
            query_parameters=[
                ScalarQueryParameter("store_id", "INT64", store_id),
                ScalarQueryParameter("floor", "INT64", floor),
                ScalarQueryParameter("start_date", "DATE", start_date),
                ScalarQueryParameter("end_date", "DATE", end_date),
                ScalarQueryParameter("start_hour", "INT64", start_hour),
                ScalarQueryParameter("end_hour", "INT64", end_hour),
            ]
        )

        try:
            query_job = self.client.query(query, job_config=job_config)
            row = list(query_job.result())[0]
            return {
                "total_visitors": row.total_visitors,
                "visitors_in_zones": row.visitors_in_zones,
                "visitors_outside_zones": row.visitors_outside_zones
            }
        except Exception as e:
            logger.error(f"Error fetching visitors outside zones: {e}")
            raise

    async def get_track_completeness(
        self,
        store_id: int,
        floor: int,
        zones: list[dict],
        start_date: date,
        end_date: date,
        start_hour: int,
        end_hour: int,
        offset_x: float = 0.0,
        offset_y: float = 0.0
    ) -> dict:
        """Analyze how many zones each visitor passed through (track completeness)."""

        if not zones:
            return {"error": "No zones provided"}

        # Build a CASE statement to count zones per visitor
        zone_cases = []
        for i, zone in enumerate(zones):
            lon_min = min(zone["x1"], zone["x2"]) - offset_x
            lon_max = max(zone["x1"], zone["x2"]) - offset_x
            lat_min = min(zone["y1"], zone["y2"]) - offset_y
            lat_max = max(zone["y1"], zone["y2"]) - offset_y
            zone_name = zone.get("name", f"Zone_{i}")
            zone_cases.append(
                f"MAX(CASE WHEN longitude BETWEEN {lon_min} AND {lon_max} AND latitude BETWEEN {lat_min} AND {lat_max} THEN 1 ELSE 0 END) as zone_{i}"
            )

        zone_columns = ", ".join(zone_cases)
        zone_sum = " + ".join([f"zone_{i}" for i in range(len(zones))])

        query = f"""
        WITH visitor_zones AS (
            SELECT
                hash_id,
                {zone_columns}
            FROM `{self.table_id}`
            WHERE store_id = @store_id
                AND floor = @floor
                AND date BETWEEN @start_date AND @end_date
                AND EXTRACT(HOUR FROM TIMESTAMP_SECONDS(timestamp)) BETWEEN @start_hour AND @end_hour
            GROUP BY hash_id
        ),
        visitor_zone_counts AS (
            SELECT
                hash_id,
                ({zone_sum}) as zones_visited
            FROM visitor_zones
        )
        SELECT
            zones_visited,
            COUNT(*) as visitor_count
        FROM visitor_zone_counts
        GROUP BY zones_visited
        ORDER BY zones_visited
        """

        job_config = QueryJobConfig(
            query_parameters=[
                ScalarQueryParameter("store_id", "INT64", store_id),
                ScalarQueryParameter("floor", "INT64", floor),
                ScalarQueryParameter("start_date", "DATE", start_date),
                ScalarQueryParameter("end_date", "DATE", end_date),
                ScalarQueryParameter("start_hour", "INT64", start_hour),
                ScalarQueryParameter("end_hour", "INT64", end_hour),
            ]
        )

        try:
            query_job = self.client.query(query, job_config=job_config)
            results = list(query_job.result())

            distribution = {row.zones_visited: row.visitor_count for row in results}
            total_visitors = sum(distribution.values())
            total_zones = len(zones)

            # Calculate completeness categories
            complete = distribution.get(total_zones, 0)  # Visited all zones
            partial = sum(v for k, v in distribution.items() if 0 < k < total_zones)
            none = distribution.get(0, 0)  # Visited no zones (shouldn't happen if data is in zones)

            return {
                "total_zones": total_zones,
                "total_visitors": total_visitors,
                "distribution": distribution,
                "complete_tracks": complete,
                "complete_pct": round(complete / total_visitors * 100, 1) if total_visitors > 0 else 0,
                "partial_tracks": partial,
                "partial_pct": round(partial / total_visitors * 100, 1) if total_visitors > 0 else 0,
            }
        except Exception as e:
            logger.error(f"Error fetching track completeness: {e}")
            raise

    async def get_zone_track_quality(
        self,
        store_id: int,
        floor: int,
        zone: dict,
        start_date: date,
        end_date: date,
        start_hour: int,
        end_hour: int,
        offset_x: float = 0.0,
        offset_y: float = 0.0
    ) -> dict:
        """
        Analyze track quality for a single zone.
        Detects incomplete tracks: those that start or end inside the zone
        without entering/exiting properly.
        """
        lon_min = min(zone["x1"], zone["x2"]) - offset_x
        lon_max = max(zone["x1"], zone["x2"]) - offset_x
        lat_min = min(zone["y1"], zone["y2"]) - offset_y
        lat_max = max(zone["y1"], zone["y2"]) - offset_y

        query = f"""
        WITH visitor_positions AS (
            SELECT
                hash_id,
                timestamp,
                longitude,
                latitude,
                CASE
                    WHEN longitude BETWEEN {lon_min} AND {lon_max}
                     AND latitude BETWEEN {lat_min} AND {lat_max}
                    THEN 1 ELSE 0
                END as in_zone
            FROM `{self.table_id}`
            WHERE store_id = @store_id
                AND floor = @floor
                AND date BETWEEN @start_date AND @end_date
                AND EXTRACT(HOUR FROM TIMESTAMP_SECONDS(timestamp)) BETWEEN @start_hour AND @end_hour
        ),
        visitor_summary AS (
            SELECT
                hash_id,
                MIN(timestamp) as first_pos_time,
                MAX(timestamp) as last_pos_time,
                MIN(CASE WHEN in_zone = 1 THEN timestamp END) as first_in_zone,
                MAX(CASE WHEN in_zone = 1 THEN timestamp END) as last_in_zone,
                MAX(in_zone) as was_in_zone,
                -- Check if they have positions before entering zone
                MAX(CASE WHEN in_zone = 0 AND timestamp < (
                    SELECT MIN(t2.timestamp) FROM visitor_positions t2
                    WHERE t2.hash_id = visitor_positions.hash_id AND t2.in_zone = 1
                ) THEN 1 ELSE 0 END) as has_entry,
                -- Check if they have positions after leaving zone
                MAX(CASE WHEN in_zone = 0 AND timestamp > (
                    SELECT MAX(t2.timestamp) FROM visitor_positions t2
                    WHERE t2.hash_id = visitor_positions.hash_id AND t2.in_zone = 1
                ) THEN 1 ELSE 0 END) as has_exit
            FROM visitor_positions
            GROUP BY hash_id
            HAVING was_in_zone = 1
        )
        SELECT
            COUNT(*) as total_in_zone,
            SUM(CASE WHEN has_entry = 1 AND has_exit = 1 THEN 1 ELSE 0 END) as complete_tracks,
            SUM(CASE WHEN has_entry = 0 AND has_exit = 1 THEN 1 ELSE 0 END) as no_entry,
            SUM(CASE WHEN has_entry = 1 AND has_exit = 0 THEN 1 ELSE 0 END) as no_exit,
            SUM(CASE WHEN has_entry = 0 AND has_exit = 0 THEN 1 ELSE 0 END) as no_entry_no_exit
        FROM visitor_summary
        """

        job_config = QueryJobConfig(
            query_parameters=[
                ScalarQueryParameter("store_id", "INT64", store_id),
                ScalarQueryParameter("floor", "INT64", floor),
                ScalarQueryParameter("start_date", "DATE", start_date),
                ScalarQueryParameter("end_date", "DATE", end_date),
                ScalarQueryParameter("start_hour", "INT64", start_hour),
                ScalarQueryParameter("end_hour", "INT64", end_hour),
            ]
        )

        try:
            query_job = self.client.query(query, job_config=job_config)
            row = list(query_job.result())[0]

            total = row.total_in_zone or 0
            complete = row.complete_tracks or 0

            return {
                "zone_name": zone.get("name", "Unknown"),
                "total_visitors": total,
                "complete_tracks": complete,
                "complete_pct": round(complete / total * 100, 1) if total > 0 else 0,
                "incomplete_tracks": {
                    "no_entry": row.no_entry or 0,  # Track starts inside zone
                    "no_exit": row.no_exit or 0,    # Track ends inside zone
                    "no_entry_no_exit": row.no_entry_no_exit or 0  # Only seen inside zone
                }
            }
        except Exception as e:
            logger.error(f"Error fetching zone track quality: {e}")
            raise

    async def get_floor_totals(
        self,
        store_id: int,
        floor: int,
        start_date: date,
        end_date: date,
        start_hour: int,
        end_hour: int
    ) -> dict:
        """Get total track count and unique visitors for entire floor.

        Useful for diagnostics to compare against zone-filtered counts.
        """
        query = f"""
        SELECT
            COUNT(*) as total_tracks,
            COUNT(DISTINCT hash_id) as unique_visitors,
            COUNT(DISTINCT CONCAT(hash_id, '-', CAST(date AS STRING))) as visitor_days
        FROM `{self.table_id}`
        WHERE store_id = @store_id
            AND floor = @floor
            AND date BETWEEN @start_date AND @end_date
            AND EXTRACT(HOUR FROM TIMESTAMP_SECONDS(timestamp)) BETWEEN @start_hour AND @end_hour
        """

        job_config = QueryJobConfig(
            query_parameters=[
                ScalarQueryParameter("store_id", "INT64", store_id),
                ScalarQueryParameter("floor", "INT64", floor),
                ScalarQueryParameter("start_date", "DATE", start_date),
                ScalarQueryParameter("end_date", "DATE", end_date),
                ScalarQueryParameter("start_hour", "INT64", start_hour),
                ScalarQueryParameter("end_hour", "INT64", end_hour),
            ]
        )

        try:
            query_job = self.client.query(query, job_config=job_config)
            row = list(query_job.result())[0]
            return {
                "total_tracks": row.total_tracks,
                "unique_visitors": row.unique_visitors,
                "visitor_days": row.visitor_days
            }
        except Exception as e:
            logger.error(f"Error fetching floor totals: {e}")
            raise

    async def test_connection(self) -> dict:
        """Test BigQuery connection and return table info"""
        try:
            # Try to get table metadata
            table = self.client.get_table(self.table_id)
            return {
                "status": "connected",
                "table": self.table_id,
                "num_rows": table.num_rows,
                "num_bytes": table.num_bytes,
                "schema": [{"name": f.name, "type": f.field_type} for f in table.schema]
            }
        except Exception as e:
            return {
                "status": "error",
                "table": self.table_id,
                "error": str(e)
            }

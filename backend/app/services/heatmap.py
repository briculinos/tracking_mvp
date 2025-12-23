from datetime import date
from typing import Optional

from app.services.bigquery import BigQueryService
from app.config import Settings


class HeatmapService:
    def __init__(self, bq_service: BigQueryService, settings: Settings):
        self.bq_service = bq_service
        self.settings = settings

    async def get_heatmap(
        self,
        store_id: int,
        floor: int,
        start_date: date,
        end_date: date,
        start_hour: int = 0,
        end_hour: int = 23,
        grid_size: Optional[float] = None
    ) -> dict:
        """Get heatmap data for visualization"""
        grid_size = grid_size or self.settings.heatmap_grid_size

        data = await self.bq_service.get_heatmap_data(
            store_id=store_id,
            floor=floor,
            start_date=start_date,
            end_date=end_date,
            start_hour=start_hour,
            end_hour=end_hour,
            grid_size=grid_size
        )

        return data

    def normalize_heatmap(self, cells: list[dict], max_value: Optional[int] = None) -> list[dict]:
        """Normalize heatmap values to 0-1 range for visualization"""
        if not cells:
            return []

        if max_value is None:
            max_value = max(c["track_count"] for c in cells)

        if max_value == 0:
            return cells

        normalized = []
        for cell in cells:
            normalized.append({
                **cell,
                "intensity": cell["track_count"] / max_value
            })

        return normalized

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # BigQuery Configuration
    gcp_project_id: str = "ingka-sot-cfm-dev"
    bq_dataset: str = ""
    bq_table: str = ""

    # Heatmap Configuration
    heatmap_grid_size: float = 1.0  # meters

    # Dwell Time Configuration
    dwell_spatial_threshold: float = 2.0  # meters
    dwell_min_time: int = 30  # seconds

    # Server Configuration
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # Storage paths
    upload_dir: str = "uploads"
    floorplans_dir: str = "uploads/floorplans"

    # AI Insights
    anthropic_api_key: str = ""

    @property
    def bq_full_table_id(self) -> str:
        return f"{self.gcp_project_id}.{self.bq_dataset}.{self.bq_table}"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()

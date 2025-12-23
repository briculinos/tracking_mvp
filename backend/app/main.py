from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os

from app.config import get_settings
from app.api.routes import stores, heatmap, dwell, zones, floorplans, insights
from app.models.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    settings = get_settings()

    # Create upload directories
    os.makedirs(settings.upload_dir, exist_ok=True)
    os.makedirs(settings.floorplans_dir, exist_ok=True)

    # Initialize database
    await init_db()

    yield
    # Shutdown
    pass


app = FastAPI(
    title="IKEA Store Tracking Heatmap API",
    description="API for visualizing store tracking data with heatmaps, dwell time analysis, and zone counting",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files for floor plans
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Include routers
app.include_router(stores.router, prefix="/api/stores", tags=["stores"])
app.include_router(heatmap.router, prefix="/api/heatmap", tags=["heatmap"])
app.include_router(dwell.router, prefix="/api/dwell", tags=["dwell"])
app.include_router(zones.router, prefix="/api/zones", tags=["zones"])
app.include_router(floorplans.router, prefix="/api/floorplans", tags=["floorplans"])
app.include_router(insights.router, prefix="/api/insights", tags=["insights"])


@app.get("/")
async def root():
    return {"message": "IKEA Store Tracking Heatmap API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.get("/api/config")
async def get_config():
    """Get current configuration (non-sensitive)"""
    settings = get_settings()
    return {
        "gcp_project_id": settings.gcp_project_id,
        "bq_dataset": settings.bq_dataset,
        "bq_table": settings.bq_table,
        "heatmap_grid_size": settings.heatmap_grid_size,
        "dwell_spatial_threshold": settings.dwell_spatial_threshold,
        "dwell_min_time": settings.dwell_min_time,
    }

# IKEA Store Tracking Heatmap - Features Documentation

## Overview

A web application for visualizing customer tracking data from IKEA stores. Displays heatmaps showing track density and dwell time analysis, with support for zone-based visitor counting and AI-powered insights.

## Architecture

```
tracking/
├── backend/          # FastAPI Python backend
│   ├── app/
│   │   ├── main.py           # App entry point
│   │   ├── config.py         # Environment configuration
│   │   ├── api/routes/       # API endpoints
│   │   ├── services/         # Business logic
│   │   └── models/           # Database models
│   ├── data/                 # SQLite DB & uploads
│   └── venv/                 # Python virtual environment
│
└── frontend/         # React + TypeScript frontend
    └── src/
        ├── components/       # UI components
        ├── hooks/            # React Query hooks
        ├── services/         # API client
        ├── types/            # TypeScript types
        └── utils/            # Helper functions
```

## Data Source

- **BigQuery Project**: `ingka-sot-cfm-dev`
- **Dataset**: `landing`
- **Table**: `trajectory_api`
- **Data Range**: Sept 2025 - Dec 2025 (~228M rows)

### Schema
| Field | Type | Description |
|-------|------|-------------|
| store_id | INTEGER | Store identifier (e.g., 445 = IKEA Malmö) |
| hash_id | STRING | Anonymous visitor/device ID |
| latitude | FLOAT | GPS latitude (~55.5° for Malmö) |
| longitude | FLOAT | GPS longitude (~13° for Malmö) |
| timestamp | INTEGER | Unix timestamp |
| floor | INTEGER | Floor number (1, 2) |
| date | DATE | Date partition |

### Store Mapping
| Store ID | Location |
|----------|----------|
| 445 | IKEA Malmö, Sweden |

---

## Features Implemented

### 1. Store & Floor Selection
- Dropdown to select store (currently Store 445 - IKEA Malmö)
- Floor selector (Floor 1, Floor 2)
- Floor plan upload capability (PNG/JPG images)

### 2. Time Filtering
- **Date Range**: Start/End date pickers
- **Hour Range**: Dual slider for start/end hours (0-23)
- **Quick Presets**: Today, Yesterday, Last 7 days, This week, This month, Last 30 days
- **Hour Presets**: All Day, 9-17, 10-20, Lunch

### 3. Heatmap Visualization

#### View Modes
- **Tracks Mode**: Shows track density (raw tracking points)
- **Dwell Time Mode**: Shows where visitors spend time (stationary periods)

#### Raw Point Rendering
- Each tracking point rendered as a small circle with radial gradient
- Gaussian blur (4px) applied for smooth, organic appearance
- Intensity map approach: overlapping semi-transparent points create natural density
- Color scale: Blue (low) → Cyan → Green → Yellow → Red (high)
- No grid aggregation - true point-based visualization

#### Smart Data Sampling
- Fetches up to **200,000 points** for rendering performance
- Uses **random sampling** when dataset exceeds limit
- Displays both "Total in DB" and "Rendered" counts
- Ensures representative data across entire time range

#### Controls
- **Min Dwell**: 10s to 300s slider (minimum time to count as "dwelling")
- **Color Scale**:
  - Auto mode: Uses data min/max automatically
  - Manual mode: Set custom min/max values

### 4. Zone Management
- Draw rectangular zones on the map (click and drag)
- Name zones for identification
- View zone statistics with **large, readable text**:
  - **Tracks Mode**: Visitors count prominently displayed
  - **Dwell Mode**: Dwell time prominently displayed, visitors secondary
- Edit/Delete zones

### 5. Statistics Display
- **Total in DB**: Total tracking points in BigQuery for selected filters
- **Rendered**: Number of points actually rendered (sampled if > 200k)
- Total dwell time (in dwell mode)
- Number of zones

### 6. AI Insights (NEW)
- **Powered by Claude** (Anthropic API)
- Click "Generate Insights" button below the heatmap
- Provides:
  - Brief analysis of customer behavior patterns
  - 3 actionable suggestions for store optimization
- Context-aware: knows store location (e.g., IKEA Malmö)
- Works for both Tracks and Dwell Time modes

---

## Technical Details

### Coordinate System
- Data uses GPS coordinates (WGS84)
- Latitude ~55.5° (Malmö, Sweden area)
- Conversion factors:
  - 1° latitude ≈ 111 km
  - 1° longitude ≈ 62 km at this latitude (cos(55.5°) ≈ 0.566)

### Heatmap Algorithm (Raw Points)
1. Backend fetches raw tracking points from BigQuery
2. If > 200k points, applies random sampling (`WHERE RAND() < rate`)
3. Returns points as `{x, y}` coordinates with total count
4. Frontend creates intensity canvas (grayscale)
5. Each point drawn as radial gradient circle (radius: 8px, opacity: 0.03)
6. Gaussian blur (4px) applied for smoothness
7. Intensity values normalized and colorized (blue → red gradient)

### Dwell Time Calculation
1. Group tracks by visitor (hash_id)
2. Sort by timestamp
3. Find stationary periods (consecutive points within spatial threshold)
4. Spatial threshold: 2 meters (configurable)
5. Minimum dwell time: 30 seconds (configurable)
6. Aggregate to grid cells for visualization

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stores` | List all stores |
| GET | `/api/stores/{id}/floors` | Get floors for store |
| GET | `/api/floorplans/store/{id}` | Get floor plans |
| POST | `/api/floorplans/upload` | Upload floor plan |
| GET | `/api/heatmap/{store_id}` | Get raw heatmap points |
| GET | `/api/dwell/{store_id}` | Get dwell time heatmap |
| GET | `/api/zones/store/{store_id}` | List zones |
| POST | `/api/zones` | Create zone |
| DELETE | `/api/zones/{id}` | Delete zone |
| POST | `/api/zones/stats` | Get zone statistics |
| POST | `/api/insights/generate` | Generate AI insights |

### Heatmap Response Format
```json
{
  "points": [{"x": 55.123, "y": 13.456}, ...],
  "bounds": {"min_x": ..., "max_x": ..., "min_y": ..., "max_y": ...},
  "total_returned": 185000,
  "total_in_database": 1250000
}
```

### Query Parameters (Heatmap)
- `floor`: Floor number
- `start_date`, `end_date`: Date range (YYYY-MM-DD)
- `start_hour`, `end_hour`: Hour range (0-23)

### Query Parameters (Dwell)
- Same as heatmap, plus:
- `min_dwell_seconds`: Minimum dwell time

---

## Configuration

### Backend (.env)
```bash
GCP_PROJECT_ID=ingka-sot-cfm-dev
BQ_DATASET=landing
BQ_TABLE=trajectory_api
HEATMAP_GRID_SIZE=1.0
DWELL_SPATIAL_THRESHOLD=2.0
DWELL_MIN_TIME=30
CORS_ORIGINS=["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"]

# AI Insights
ANTHROPIC_API_KEY=sk-ant-...
```

### Frontend Defaults
- Default dates: November 2025
- Default floor: 1
- Default min dwell: 30s

---

## Running the Application

### Backend
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend
```bash
cd frontend
npm run dev
```

### Access
- Frontend: http://localhost:5173 (or 5174, 5175 if ports busy)
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

---

## Dependencies

### Backend
- FastAPI, Uvicorn
- google-cloud-bigquery
- SQLAlchemy (async with aiosqlite)
- Pydantic, pydantic-settings
- python-multipart (file uploads)
- anthropic (AI insights)

### Frontend
- React 18 + TypeScript
- Vite (build tool)
- TanStack React Query (data fetching)
- Tailwind CSS (styling)
- Axios (HTTP client)
- react-hot-toast (notifications)
- date-fns (date formatting)

---

## Recent Updates

### Raw Point Rendering (replaces grid-based)
- Smooth, organic heatmap appearance
- No more blocky grid artifacts
- Each point rendered individually with gaussian blur

### Smart Sampling
- Handles millions of data points efficiently
- Random sampling preserves data distribution
- Shows actual database count vs rendered count

### AI Insights (Enhanced)
- Claude-powered analysis of store data
- Actionable retail optimization suggestions
- Store-aware context (knows IKEA Malmö)
- **Custom prompt input**: Type specific questions for focused analysis
- **Clickable items**: Click on any Alarm or Action to get detailed Q&A follow-up
- **Q&A mode**: Follow-up responses are direct 4-6 sentence answers
- **Back to overview**: Return to original insights after viewing Q&A answer

### Improved Zone Display
- Larger, more readable text
- Context-aware: dwell time prominent in dwell mode, visitors in tracks mode

---

## Known Limitations

1. **Single Store**: Currently optimized for Store 445; multi-store needs country hierarchy
2. **Sampling**: Very large date ranges show sampled data (max 200k points)
3. **Floor Plan Calibration**: Manual coordinate mapping needed when uploading floor plans
4. **GPS Coordinates**: Hardcoded latitude conversion for ~55.5° (Malmö area)

---

## Future Enhancements

- [ ] Country → Store hierarchy
- [ ] Path/journey visualization
- [ ] Time-lapse animation
- [ ] Export reports (PDF/CSV)
- [ ] Compare time periods
- [ ] Real-time data streaming
- [ ] Mobile responsive layout
- [ ] More detailed AI insights with heatmap image analysis

---

## Checkpoint: Pre-UI Redesign (2025-12-23)

**Current State**: Stable baseline before major UI changes
- Two-column layout: Tracks + Dwell panels side by side
- AI Insights panel below with Q&A follow-up support
- Sidebar with floor plan calibration and zone management
- Legend in top-right corner of heatmap panels

**To restore this state**: `git checkout <this-commit-hash>`

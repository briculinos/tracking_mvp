# IKEA Store Tracking Heatmap

A web application to visualize store tracking data with heatmaps, dwell time analysis, and zone-based visitor counting.

## Features

### Core Visualization
- **Dual Heatmap View**: Side-by-side Tracks (movement density) and Dwell (time spent) heatmaps
- **Floor Plan Overlay**: Upload and calibrate store floor plan images with affine transformation support
- **Time Filtering**: Filter by date range (multi-day) and hour of day range

### Zone Analytics
- **Zone Management**: Draw rectangular zones on the floor plan
- **Accumulated Visits**: Track total visits per zone (visitor-days, not just unique visitors)
- **Average Dwell Time**: Per-zone average time spent by visitors
- **Zone Coverage Report**: Check what percentage of visitors pass through defined zones
- **Track Completeness**: Analyze complete vs incomplete tracks per zone (entry/exit detection)

### Visitor Metrics
- **Visitor Days**: Accumulated visits (same person on different days = multiple visits)
- **Unique Visitors**: Distinct devices tracked over the period
- **Position Count**: Total GPS/WiFi position readings
- **Capture Rate**: Compare tracked visitors vs door counter data

### AI Insights
- **Claude-Powered Analysis**: Generate AI insights from heatmap and dwell data
- **Retail Intelligence**: Professional prompts for IKEA store analysis
- **Actionable Recommendations**: Get alarms, risks, and recommended actions

### Reporting
- **PDF Export**: Download multi-page PDF with Tracks, Dwell, and AI Insights
- **Data Diagnostics**: Check data quality, date ranges, and daily breakdowns

## Tech Stack

- **Backend**: Python, FastAPI, BigQuery
- **Frontend**: React, TypeScript, Tailwind CSS
- **Database**: SQLite (for metadata), BigQuery (tracking data)

## Prerequisites

- Python 3.11+
- Node.js 20+
- GCP account with BigQuery access
- GCP Application Default Credentials configured

## Setup

### 1. Configure GCP Credentials

```bash
# Login with your GCP account
gcloud auth application-default login
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your BigQuery dataset and table names
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install
```

### 4. Configure BigQuery

Edit `backend/.env`:

```env
GCP_PROJECT_ID=ingka-sot-cfm-dev
BQ_DATASET=your_dataset_name
BQ_TABLE=your_table_name
```

## Running the Application

### Development Mode

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Access the app at http://localhost:5173

### Using Docker

```bash
# Create .env file first
cp backend/.env.example backend/.env
# Edit backend/.env

# Run with docker-compose
docker-compose up --build

# Or for development with hot reload:
docker-compose --profile dev up
```

## API Endpoints

### Stores & Floor Plans
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stores` | List all stores |
| GET | `/api/floorplans/store/{store_id}` | Get floor plans for a store |
| POST | `/api/floorplans/upload` | Upload floor plan image |
| PUT | `/api/floorplans/{id}/adjust` | Update calibration settings |

### Heatmap Data
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/heatmap/{store_id}` | Get track positions for heatmap |
| GET | `/api/heatmap/diagnostic/{store_id}` | Get data quality diagnostics |
| GET | `/api/dwell/{store_id}` | Get dwell time heatmap |

### Zone Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/zones/store/{store_id}` | List zones for store/floor |
| POST | `/api/zones` | Create a new zone |
| DELETE | `/api/zones/{zone_id}` | Delete a zone |
| POST | `/api/zones/stats` | Get statistics for multiple zones |
| GET | `/api/zones/coverage/{store_id}` | Check zone coverage (visitors in/out of zones) |
| GET | `/api/zones/completeness/{store_id}` | Track completeness report (zones visited per visitor) |
| GET | `/api/zones/quality/{zone_id}` | Track quality for a zone (complete vs incomplete tracks) |

### AI Insights
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/insights/generate` | Generate AI-powered retail insights |

## Key Metrics Explained

| Metric | Description | Example |
|--------|-------------|---------|
| **Positions** | Total GPS/WiFi readings in database | 45,000,000 |
| **Unique Visitors** | Distinct devices (hash_ids) tracked | 13,431 |
| **Visitor Days (Visits)** | Accumulated visits (same person, different days = multiple) | 185,053 |
| **Capture Rate** | Visitor Days / Door Counter entries | ~83% |

**Why the distinction matters:**
- Door counters measure **entries** (222K in a month)
- Tracking measures **unique devices** (13K) that visit multiple times (~14x avg)
- Accumulated visits (185K) is closer to door counter and more useful for zone analytics

## Data Schema

The application expects BigQuery data with this schema:

| Field | Type | Description |
|-------|------|-------------|
| store_id | INTEGER | Store identifier |
| hash_id | STRING | Visitor/device identifier |
| latitude | FLOAT | X coordinate (meters) |
| longitude | FLOAT | Y coordinate (meters) |
| timestamp | INTEGER | Unix timestamp |
| floor | INTEGER | Floor number |
| uncertainty | INTEGER | Position accuracy |
| date | DATE | Date partition |

## Configuration

### Grid Size

Adjust `HEATMAP_GRID_SIZE` in `.env` to control heatmap resolution:
- Smaller (0.5m): More detail, slower queries
- Larger (2-5m): Less detail, faster queries

### Dwell Time

- `DWELL_SPATIAL_THRESHOLD`: Distance threshold for same location (default: 2m)
- `DWELL_MIN_TIME`: Minimum time to count as dwelling (default: 30s)

## Floor Plan Calibration

When uploading a floor plan, you need to map image coordinates to data coordinates:

1. Find the min/max X and Y values in your tracking data
2. Enter these as the calibration bounds when uploading
3. The system will map data points to the correct positions on the image

## License

Internal use only.

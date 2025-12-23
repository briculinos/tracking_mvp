# IKEA Store Tracking Heatmap - C4 Architecture

## Level 1: System Context Diagram

```plantuml
@startuml C4_Context
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Context.puml

title System Context Diagram - IKEA Store Tracking Heatmap

Person(analyst, "Retail Analyst", "Analyzes customer movement patterns and dwell times")
Person(manager, "Store Manager", "Reviews store performance and zone metrics")

System(tracking_system, "IKEA Store Tracking System", "Visualizes customer tracking data through heatmaps, dwell time analysis, and AI-powered insights")

System_Ext(bigquery, "Google BigQuery", "Data warehouse storing ~228M rows of customer tracking data (GPS/WiFi positions)")
System_Ext(anthropic, "Anthropic Claude API", "AI service for generating retail intelligence insights")
System_Ext(gcp, "Google Cloud Platform", "Authentication and infrastructure services")

Rel(analyst, tracking_system, "Analyzes heatmaps, creates zones, generates insights")
Rel(manager, tracking_system, "Reviews zone statistics and AI recommendations")
Rel(tracking_system, bigquery, "Queries tracking data", "BigQuery SQL")
Rel(tracking_system, anthropic, "Generates AI insights", "HTTPS/REST")
Rel(tracking_system, gcp, "Authenticates", "Application Default Credentials")

@enduml
```

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│    ┌──────────────┐                              ┌──────────────┐           │
│    │   Retail     │                              │    Store     │           │
│    │   Analyst    │                              │   Manager    │           │
│    └──────┬───────┘                              └──────┬───────┘           │
│           │                                             │                   │
│           │  Analyzes heatmaps                          │ Reviews zone      │
│           │  Creates zones                              │ statistics        │
│           │  Generates insights                         │                   │
│           │                                             │                   │
│           └─────────────────┬───────────────────────────┘                   │
│                             │                                               │
│                             ▼                                               │
│              ┌──────────────────────────────┐                               │
│              │  IKEA Store Tracking System  │                               │
│              │                              │                               │
│              │  Visualizes customer         │                               │
│              │  tracking data through       │                               │
│              │  heatmaps, dwell time,       │                               │
│              │  and AI insights             │                               │
│              └──────────────┬───────────────┘                               │
│                             │                                               │
│           ┌─────────────────┼─────────────────┐                             │
│           │                 │                 │                             │
│           ▼                 ▼                 ▼                             │
│  ┌─────────────────┐ ┌─────────────┐ ┌──────────────────┐                   │
│  │ Google BigQuery │ │  Anthropic  │ │       GCP        │                   │
│  │                 │ │  Claude API │ │                  │                   │
│  │ ~228M tracking  │ │             │ │ Authentication   │                   │
│  │ data rows       │ │ AI Insights │ │ Infrastructure   │                   │
│  └─────────────────┘ └─────────────┘ └──────────────────┘                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Level 2: Container Diagram

```plantuml
@startuml C4_Container
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Container.puml

title Container Diagram - IKEA Store Tracking Heatmap

Person(user, "User", "Retail analyst or store manager")

System_Boundary(tracking_system, "IKEA Store Tracking System") {
    Container(frontend, "Frontend SPA", "React, TypeScript, Vite", "Single-page application for heatmap visualization and analysis")
    Container(backend, "Backend API", "Python, FastAPI", "RESTful API handling data queries, zone management, and AI insights")
    ContainerDb(sqlite, "SQLite Database", "SQLite", "Stores zones, floor plans, and store metadata")
}

System_Ext(bigquery, "Google BigQuery", "Tracking data warehouse")
System_Ext(anthropic, "Anthropic Claude API", "AI insights generation")

Rel(user, frontend, "Uses", "HTTPS")
Rel(frontend, backend, "API calls", "HTTP/REST")
Rel(backend, sqlite, "Reads/Writes", "SQL")
Rel(backend, bigquery, "Queries tracking data", "BigQuery API")
Rel(backend, anthropic, "Generates insights", "HTTPS")

@enduml
```

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         IKEA Store Tracking System                                  │
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                                                                             │    │
│  │   ┌─────────────┐          HTTP/REST          ┌─────────────────────────┐   │    │
│  │   │             │◄────────────────────────────│                         │   │    │
│  │   │  Frontend   │                             │      Backend API        │   │    │
│  │   │    SPA      │────────────────────────────►│                         │   │    │
│  │   │             │                             │  Python 3.11+           │   │    │
│  │   │ React 18    │                             │  FastAPI                │   │    │
│  │   │ TypeScript  │                             │  Uvicorn                │   │    │
│  │   │ Vite        │                             │                         │   │    │
│  │   │ TailwindCSS │                             └───────────┬─────────────┘   │    │
│  │   │ React Query │                                         │                 │    │
│  │   │             │                                         │                 │    │
│  │   └─────────────┘                                         │                 │    │
│  │         ▲                                    ┌────────────┼────────────┐    │    │
│  │         │                                    │            │            │    │    │
│  │         │                                    ▼            ▼            ▼    │    │
│  │    ┌────┴────┐                    ┌──────────────┐ ┌───────────┐ ┌────────┐│    │
│  │    │  User   │                    │    SQLite    │ │ BigQuery  │ │Anthropic│    │
│  │    │         │                    │   Database   │ │           │ │Claude   │    │
│  │    │ Analyst │                    │              │ │ Tracking  │ │  API    │    │
│  │    │ Manager │                    │ Zones        │ │ Data      │ │         │    │
│  │    └─────────┘                    │ Floor Plans  │ │ Warehouse │ │AI       │    │
│  │                                   │ Store Meta   │ │           │ │Insights │    │
│  │                                   └──────────────┘ └───────────┘ └────────┘│    │
│  │                                                                             │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Level 3: Component Diagram - Backend

```plantuml
@startuml C4_Component_Backend
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Component.puml

title Component Diagram - Backend API

Container_Boundary(backend, "Backend API") {
    Component(main, "Main Application", "FastAPI", "Application entry point, middleware, router registration")

    Component(stores_router, "Stores Router", "API Routes", "/api/stores - Store listing and metadata")
    Component(heatmap_router, "Heatmap Router", "API Routes", "/api/heatmap - Raw tracking points")
    Component(dwell_router, "Dwell Router", "API Routes", "/api/dwell - Dwell time heatmap")
    Component(zones_router, "Zones Router", "API Routes", "/api/zones - Zone CRUD and stats")
    Component(floorplans_router, "Floor Plans Router", "API Routes", "/api/floorplans - Upload and calibration")
    Component(insights_router, "Insights Router", "API Routes", "/api/insights - AI analysis")

    Component(bq_service, "BigQuery Service", "Service", "Queries tracking data from BigQuery")
    Component(dwell_service, "Dwell Time Service", "Service", "Calculates dwell time aggregations")
    Component(zone_service, "Zone Counter Service", "Service", "Computes zone visitor statistics")

    Component(db_models, "Database Models", "SQLAlchemy", "ORM models for SQLite")
    Component(config, "Configuration", "Pydantic Settings", "Environment configuration")
}

ContainerDb(sqlite, "SQLite", "Database")
System_Ext(bigquery, "BigQuery", "Data Warehouse")
System_Ext(anthropic, "Anthropic API", "AI Service")

Rel(main, stores_router, "Routes")
Rel(main, heatmap_router, "Routes")
Rel(main, dwell_router, "Routes")
Rel(main, zones_router, "Routes")
Rel(main, floorplans_router, "Routes")
Rel(main, insights_router, "Routes")

Rel(stores_router, bq_service, "Uses")
Rel(heatmap_router, bq_service, "Uses")
Rel(dwell_router, dwell_service, "Uses")
Rel(zones_router, zone_service, "Uses")
Rel(zone_service, bq_service, "Uses")
Rel(zone_service, dwell_service, "Uses")

Rel(zones_router, db_models, "CRUD")
Rel(floorplans_router, db_models, "CRUD")

Rel(bq_service, bigquery, "Queries")
Rel(insights_router, anthropic, "API Calls")
Rel(db_models, sqlite, "Reads/Writes")

@enduml
```

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                 Backend API                                         │
│                                                                                     │
│  ┌──────────────────────────────────────────────────────────────────────────────┐   │
│  │                           API Layer (FastAPI Routers)                        │   │
│  │                                                                              │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐│   │
│  │  │ /stores  │ │/heatmap  │ │  /dwell  │ │  /zones  │ │/floorplan│ │/insight││   │
│  │  │          │ │          │ │          │ │          │ │          │ │        ││   │
│  │  │ List     │ │ Raw      │ │ Dwell    │ │ CRUD     │ │ Upload   │ │ AI     ││   │
│  │  │ stores   │ │ tracking │ │ time     │ │ zones    │ │ Calibrate│ │ Generate│   │
│  │  │ floors   │ │ points   │ │ cells    │ │ Stats    │ │ Adjust   │ │        ││   │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └───┬────┘│   │
│  │       │            │            │            │            │           │     │   │
│  └───────┼────────────┼────────────┼────────────┼────────────┼───────────┼─────┘   │
│          │            │            │            │            │           │         │
│  ┌───────┼────────────┼────────────┼────────────┼────────────┼───────────┼─────┐   │
│  │       │            │            │            │            │           │     │   │
│  │       │  Services Layer         │            │            │           │     │   │
│  │       ▼            ▼            ▼            ▼            │           │     │   │
│  │  ┌────────────────────────┐ ┌─────────────────────┐       │           │     │   │
│  │  │   BigQuery Service     │ │  Dwell Time Service │       │           │     │   │
│  │  │                        │ │                     │       │           │     │   │
│  │  │ • get_stores()         │ │ • get_dwell_heatmap │       │           │     │   │
│  │  │ • get_raw_tracks()     │ │                     │       │           │     │   │
│  │  │ • get_floor_totals()   │ └──────────┬──────────┘       │           │     │   │
│  │  │ • get_zone_stats()     │            │                  │           │     │   │
│  │  └───────────┬────────────┘            │                  │           │     │   │
│  │              │                         │                  │           │     │   │
│  │              │    ┌────────────────────┴───────┐          │           │     │   │
│  │              │    │   Zone Counter Service     │          │           │     │   │
│  │              │    │                            │          │           │     │   │
│  │              │    │ • get_zone_stats()         │          │           │     │   │
│  │              │    │ • Combines BQ + Dwell      │          │           │     │   │
│  │              │    └────────────────────────────┘          │           │     │   │
│  │              │                                            │           │     │   │
│  └──────────────┼────────────────────────────────────────────┼───────────┼─────┘   │
│                 │                                            │           │         │
│  ┌──────────────┼────────────────────────────────────────────┼───────────┼─────┐   │
│  │              │         Data Layer                         │           │     │   │
│  │              ▼                                            ▼           │     │   │
│  │  ┌─────────────────────┐                    ┌─────────────────────┐   │     │   │
│  │  │    Google BigQuery  │                    │  SQLite Database    │   │     │   │
│  │  │                     │                    │                     │   │     │   │
│  │  │  • trajectory_api   │                    │ • ZoneModel         │   │     │   │
│  │  │  • ~228M rows       │                    │ • FloorPlanModel    │   │     │   │
│  │  │  • GPS positions    │                    │ • StoreModel        │   │     │   │
│  │  └─────────────────────┘                    └─────────────────────┘   │     │   │
│  │                                                                       │     │   │
│  └───────────────────────────────────────────────────────────────────────┼─────┘   │
│                                                                          │         │
│                                                                          ▼         │
│                                                              ┌─────────────────┐   │
│                                                              │  Anthropic API  │   │
│                                                              │  Claude Sonnet  │   │
│                                                              └─────────────────┘   │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Level 3: Component Diagram - Frontend

```plantuml
@startuml C4_Component_Frontend
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Component.puml

title Component Diagram - Frontend SPA

Container_Boundary(frontend, "Frontend SPA") {
    Component(app, "App", "React Component", "Root component, state management, routing")

    Component(header, "ReportingHeader", "React Component", "Store/Floor/Date/Hour filters")
    Component(sidebar, "Sidebar", "React Component", "Floor plan preview, calibration, zone list")
    Component(heatmap_panel, "HeatmapPanel", "React Component", "Heatmap visualization container")
    Component(heatmap_canvas, "HeatmapCanvas", "React Component", "Canvas-based heatmap rendering")
    Component(insights_panel, "InsightsPanel", "React Component", "AI insights display and Q&A")
    Component(floorplan_upload, "FloorPlanUpload", "React Component", "Floor plan upload modal")

    Component(use_stores, "useStores", "React Query Hook", "Store and floor plan data fetching")
    Component(use_heatmap, "useHeatmapData", "React Query Hook", "Heatmap/Dwell data fetching")
    Component(use_zones, "useZones", "React Query Hook", "Zone CRUD and statistics")

    Component(api_service, "API Service", "Axios", "HTTP client for backend communication")
    Component(coordinates, "Coordinates Utils", "TypeScript", "Coordinate transformations and conversions")
}

Container(backend, "Backend API", "FastAPI")

Rel(app, header, "Renders")
Rel(app, sidebar, "Renders")
Rel(app, heatmap_panel, "Renders")
Rel(app, insights_panel, "Renders")
Rel(app, floorplan_upload, "Renders")

Rel(heatmap_panel, heatmap_canvas, "Contains")

Rel(app, use_stores, "Uses")
Rel(app, use_heatmap, "Uses")
Rel(app, use_zones, "Uses")

Rel(use_stores, api_service, "Calls")
Rel(use_heatmap, api_service, "Calls")
Rel(use_zones, api_service, "Calls")
Rel(insights_panel, api_service, "Calls")

Rel(heatmap_canvas, coordinates, "Uses")

Rel(api_service, backend, "HTTP/REST")

@enduml
```

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                  Frontend SPA                                       │
│                                                                                     │
│  ┌──────────────────────────────────────────────────────────────────────────────┐   │
│  │                              UI Components                                    │   │
│  │                                                                              │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │                              App.tsx                                    │ │   │
│  │  │  • Root component & state management                                    │ │   │
│  │  │  • Filter state (store, floor, dates, hours)                           │ │   │
│  │  │  • Calibration logic (affine transform)                                │ │   │
│  │  │  • PDF export                                                          │ │   │
│  │  └─────────────────────────────────────────────────────────────────────────┘ │   │
│  │                                    │                                         │   │
│  │          ┌─────────────────────────┼─────────────────────────┐               │   │
│  │          │                         │                         │               │   │
│  │          ▼                         ▼                         ▼               │   │
│  │  ┌───────────────┐    ┌────────────────────────┐    ┌───────────────────┐    │   │
│  │  │   Sidebar     │    │    ReportingHeader     │    │  HeatmapPanel     │    │   │
│  │  │               │    │                        │    │                   │    │   │
│  │  │ • Floor plan  │    │ • Store selector       │    │ • Tracks/Dwell    │    │   │
│  │  │ • Calibration │    │ • Floor selector       │    │   toggle          │    │   │
│  │  │ • Zone list   │    │ • Date range           │    │ • Zoom controls   │    │   │
│  │  │ • Zone stats  │    │ • Hour range           │    │ • Display mode    │    │   │
│  │  └───────────────┘    │ • PDF export           │    │                   │    │   │
│  │                       └────────────────────────┘    │  ┌─────────────┐  │    │   │
│  │                                                     │  │HeatmapCanvas│  │    │   │
│  │  ┌───────────────────┐                              │  │             │  │    │   │
│  │  │  InsightsPanel    │                              │  │• Canvas     │  │    │   │
│  │  │                   │                              │  │• Zones      │  │    │   │
│  │  │ • AI Analysis     │                              │  │• Legend     │  │    │   │
│  │  │ • Alarms          │                              │  │• Pan/Zoom   │  │    │   │
│  │  │ • Actions         │                              │  └─────────────┘  │    │   │
│  │  │ • Q&A Follow-up   │                              └───────────────────┘    │   │
│  │  └───────────────────┘                                                       │   │
│  │                                                                              │   │
│  └──────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  ┌──────────────────────────────────────────────────────────────────────────────┐   │
│  │                           Data Layer (Hooks)                                 │   │
│  │                                                                              │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐            │   │
│  │  │   useStores      │  │  useHeatmapData  │  │    useZones      │            │   │
│  │  │                  │  │                  │  │                  │            │   │
│  │  │ • Store list     │  │ • Tracks data    │  │ • Zone CRUD      │            │   │
│  │  │ • Floor plans    │  │ • Dwell data     │  │ • Zone stats     │            │   │
│  │  │ • Connection     │  │ • 5min cache     │  │ • Multi-zone     │            │   │
│  │  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘            │   │
│  │           │                     │                     │                      │   │
│  │           └─────────────────────┼─────────────────────┘                      │   │
│  │                                 │                                            │   │
│  │                                 ▼                                            │   │
│  │                     ┌───────────────────────┐                                │   │
│  │                     │     API Service       │                                │   │
│  │                     │      (Axios)          │                                │   │
│  │                     │                       │                                │   │
│  │                     │  baseURL: /api        │                                │   │
│  │                     └───────────┬───────────┘                                │   │
│  │                                 │                                            │   │
│  └─────────────────────────────────┼────────────────────────────────────────────┘   │
│                                    │                                                │
│                                    ▼                                                │
│                          ┌─────────────────┐                                        │
│                          │   Backend API   │                                        │
│                          │    (FastAPI)    │                                        │
│                          └─────────────────┘                                        │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                  Data Flow                                             │
│                                                                                        │
│  ┌─────────────┐                                                                       │
│  │    User     │                                                                       │
│  │  Selects    │                                                                       │
│  │  Filters    │                                                                       │
│  └──────┬──────┘                                                                       │
│         │                                                                              │
│         ▼                                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐       │
│  │  App.tsx     │────►│ useHeatmap   │────►│ API Service  │────►│ GET /heatmap │       │
│  │  setState    │     │ Data Hook    │     │ getHeatmap() │     │              │       │
│  └──────────────┘     └──────────────┘     └──────────────┘     └──────┬───────┘       │
│                                                                         │              │
│                                                                         ▼              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐       │
│  │ HeatmapCanvas│◄────│ HeatmapPanel │◄────│ React Query  │◄────│  BigQuery    │       │
│  │   Render     │     │    Pass      │     │    Cache     │     │   Service    │       │
│  └──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘       │
│                                                                                        │
│  ═══════════════════════════════════════════════════════════════════════════════════   │
│                                                                                        │
│  ┌─────────────┐                                                                       │
│  │    User     │                                                                       │
│  │  Generates  │                                                                       │
│  │  Insights   │                                                                       │
│  └──────┬──────┘                                                                       │
│         │                                                                              │
│         ▼                                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐       │
│  │InsightsPanel │────►│ API Service  │────►│POST /insights│────►│  Anthropic   │       │
│  │  Generate    │     │    fetch     │     │   /generate  │     │  Claude API  │       │
│  └──────────────┘     └──────────────┘     └──────────────┘     └──────┬───────┘       │
│         ▲                                                               │              │
│         │                                                               │              │
│         └───────────────────────────────────────────────────────────────┘              │
│                           Parse: Analysis, Alarms, Actions                             │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack Summary

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React 18 | UI framework |
| | TypeScript | Type safety |
| | Vite | Build tool |
| | TanStack Query | Data fetching & caching |
| | Tailwind CSS | Styling |
| | Axios | HTTP client |
| | HTML Canvas | Heatmap rendering |
| **Backend** | Python 3.11+ | Runtime |
| | FastAPI | Web framework |
| | Uvicorn | ASGI server |
| | SQLAlchemy 2.0 | ORM (async) |
| | Pydantic | Data validation |
| **Database** | SQLite | Local metadata |
| | BigQuery | Tracking data warehouse |
| **External** | Anthropic Claude | AI insights |
| | GCP | Authentication |

---

## Deployment View

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Deployment Architecture                            │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                           Docker Compose                                │    │
│  │                                                                         │    │
│  │   ┌─────────────────────────┐      ┌─────────────────────────┐         │    │
│  │   │    Frontend Container   │      │    Backend Container    │         │    │
│  │   │                         │      │                         │         │    │
│  │   │  Nginx                  │      │  Uvicorn                │         │    │
│  │   │  Port: 80               │─────►│  Port: 8000             │         │    │
│  │   │                         │      │                         │         │    │
│  │   │  /api/* → proxy:8000    │      │  /api/* endpoints       │         │    │
│  │   │  /* → static files      │      │  /uploads/* static      │         │    │
│  │   │                         │      │                         │         │    │
│  │   └─────────────────────────┘      └───────────┬─────────────┘         │    │
│  │                                                │                       │    │
│  │                                    ┌───────────┼───────────┐           │    │
│  │                                    │           │           │           │    │
│  │                                    ▼           ▼           ▼           │    │
│  │                            ┌───────────┐ ┌──────────┐ ┌──────────┐     │    │
│  │                            │  Volume:  │ │  Volume: │ │  .env    │     │    │
│  │                            │ tracking  │ │ uploads/ │ │  file    │     │    │
│  │                            │   .db     │ │floorplans│ │          │     │    │
│  │                            └───────────┘ └──────────┘ └──────────┘     │    │
│  │                                                                         │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                          │                                      │
│                    ┌─────────────────────┼─────────────────────┐                │
│                    │                     │                     │                │
│                    ▼                     ▼                     ▼                │
│           ┌──────────────┐      ┌──────────────┐      ┌──────────────┐          │
│           │   BigQuery   │      │   Anthropic  │      │     GCP      │          │
│           │  (External)  │      │    (SaaS)    │      │    (Auth)    │          │
│           └──────────────┘      └──────────────┘      └──────────────┘          │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

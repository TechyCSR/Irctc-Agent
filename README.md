# IRCTC AGENT

> **Universal High-Performance Indian Railways Route & Confirmed Seat Discovery System**

[![TypeScript](https://img.shields.io/badge/Frontend-React%2019%20%2B%20TypeScript-000000?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%20%2B%20Python%203.11-000000?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Three.js](https://img.shields.io/badge/Graphics-Three.js-000000?style=flat&logo=three.js)](https://threejs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Styles-Tailwind%20CSS%20v4-000000?style=flat&logo=tailwindcss)](https://tailwindcss.com/)

---

## Overview

When popular direct trains on Indian Railways (IRCTC) are completely waitlisted (`GNWL`, `PQWL`, `RLWL`) or marked as `REGRET`, **IRCTC AGENT** discovers alternative 1-transfer itineraries across natural railway corridors with guaranteed layover safety and confirmed seat availability.

The system features:
1. **8,566 Official Railway Stations**: Full national database with latitude/longitude coordinates and city cluster aliases.
2. **Dynamic Corridor Pathfinder**: Haversine distance and detour ratio algorithm ($\le 1.35$) selects intermediate junction hubs for *any* station pair across India.
3. **Layover Safety Guarantee**: Validates transfer buffers between 60 to 360 minutes with overnight carryover, preventing missed trains.
4. **Canonical Station Deduplication**: Unifies satellite stations (e.g., Delhi `NDLS`/`NZM`/`DLI` or Bengaluru `SBC`/`SMVB`/`YPR`) into single recommendations.
5. **Combined Fare Calculation**: Computes accurate multi-leg ticket fares across all classes (`3A`, `2A`, `1A`, `SL`, `3E`, `CC`).
6. **Minimal Black & White Design**: High-contrast modern interface with interactive Three.js ambient route canvas and zero visual clutter.

---

## System Architecture

```
                    ┌─────────────────────────┐
                    │      React Frontend      │
                    │   (Vite + TS + ThreeJS) │
                    └───────────┬─────────────┘
                                │
                    HTTP / SSE  │  VITE_API_URL
                                ▼
                    ┌─────────────────────────┐
                    │     FastAPI Backend      │
                    │   (Port 8000 / Docker)  │
                    └─────┬──────────────┬────┘
                          │              │
       ┌──────────────────▼──┐        ┌──▼──────────────────┐
       │ 8,566 Station DB    │        │ Public IRCTC Engine │
       │ & Corridor Geometry │        │ & Live Availability │
       └─────────────────────┘        └─────────────────────┘
```

---

## Independent Deployment

The frontend and backend are completely decoupled and can be deployed independently on different cloud platforms.

### 1. Backend Deployment (Docker / Render / Railway / Fly.io)

- **Root Directory**: `backend/`
- **Port**: Configured via `PORT` (defaults to `8000`)
- **CORS**: Set `CORS_ORIGINS` to allow requests from your frontend domain (e.g. `https://irctc-agent.vercel.app` or `*`)

**Using Docker**:
```bash
docker build -f backend/Dockerfile -t irctc-agent-backend .
docker run -p 8000:8000 -e CORS_ORIGINS="*" irctc-agent-backend
```

**Using Procfile (Render / Railway / Heroku)**:
```bash
web: uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-8000}
```

### 2. Frontend Deployment (Vercel / Netlify / Cloudflare Pages)

- **Root Directory**: `frontend/`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Environment Variables**:
  - `VITE_API_URL`: Set to your deployed backend URL (e.g., `https://irctc-agent-api.onrender.com`)

SPA rewrites are pre-configured in [`frontend/vercel.json`](file:///home/techycsr/Documents/Projects/Irctc-Agent/frontend/vercel.json).

---

## Local Development

### Prerequisites
- Python 3.10+
- Node.js 18+

### Step 1: Start Backend
```bash
# Setup virtual environment
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt

# Run FastAPI server
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

Backend API Docs available at `http://localhost:8000/docs`.

### Step 2: Start Frontend
```bash
cd frontend
npm install
npm run dev
```

Frontend application available at `http://localhost:3000`.

---

## API Reference

### 1. Autocomplete Stations
```http
GET /api/stations/search?q=NDLS
```
Returns matching stations from all 8,566 indexed Indian railway stations with code, name, city, state, and junction metadata.

### 2. Synchronous Route Search
```http
GET /api/search?from=NDLS&to=CSMT&date=12-10-2026&quota=GN&class=3A
```
Returns scored and deduplicated routes with confirmed seats, layover details, and total fares.

### 3. Server-Sent Events (SSE) Stream
```http
GET /api/search/stream?from=JU&to=SBC&date=12-10-2026&quota=GN
```
Instantly streams direct trains first, followed by intermediate corridor connections as they are discovered.

---

## License
MIT

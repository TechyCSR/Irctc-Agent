# 🚄 IRCTC AGENT

> **Intelligent Indian Railways Route Discovery, Confirmed Berth Optimization & 3D Visualizer**

[![TypeScript](https://img.shields.io/badge/Frontend-React%2019%20%2B%20TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%20%2B%20Python%203.11-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Three.js](https://img.shields.io/badge/3D%20Engine-Three.js%20WebGL-000000?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Styles-Tailwind%20CSS%20v4-38BDF8?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

---

## 🌟 Overview

When popular direct trains on Indian Railways (IRCTC) are completely waitlisted (`GNWL`, `PQWL`, `RLWL`) or marked as `REGRET`, **IRCTC AGENT** discovers alternative confirmed itineraries across natural railway corridors with guaranteed layover safety and live seat availability.

Built with high-contrast glassmorphism, OLED dark mode, responsive mobile layout, and an interactive 3D WebGL train visualizer, it turns complex railway routing into an effortless discovery experience.

---

## ✨ Key Features

### 🧠 Intelligent Route Finder & Seat Discovery
- **8,566 Indexed Stations**: Complete national station database with GPS coordinates, junction metadata, and canonical satellite cluster unifications (e.g. `NDLS`/`NZM`/`DLI` for Delhi, `SBC`/`SMVB`/`YPR` for Bengaluru).
- **Corridor Detour Algorithm**: Computes Haversine great-circle detours ($\le 1.35$) to surface optimal transfer junctions across India.
- **Layover Safety Buffer**: Enforces reliable connection windows (60 to 360 minutes with overnight carryover) to guarantee passengers never miss a connecting train.
- **Same-Train Split Ticketing**: Identifies confirmed seat vacancies across different station segments on the *same train* without switching coaches.
- **Alternate Boarding Point Discovery**: Uncovers confirmed berths available from earlier origin stations with designated passenger boarding downstream.
- **5-Day Matrix Strip**: Visual quick-picker for adjacent travel dates and quota availability (`GN`, `TQ`, `LD`, `SS`).

### 🎮 Interactive 3D WebGL Train Experience
- **Aerodynamic 3-Car Rake**: Procedural Vande Bharat-style express train with rotating bogie wheels, suspension oscillations, high-beam headlights, and glowing amber destination LED display.
- **Multi-Camera Cinematic Views**:
  - 🪟 **Window View (Default)**: Over-the-shoulder passenger perspective with trees zooming past the window flank.
  - 🪐 **Orbit 3D**: Elevated orbital perspective with mouse parallax navigation.
  - 🛤️ **Trackside**: Low-angle railfan angle right beside the rolling steel wheels.
  - 👨‍✈️ **Driver Front**: Front chase view looking ahead along the rails toward the horizon.
- **Lush Countryside Scenery**: Multi-layered trackside conifers and broadleaf trees, rolling terrain, 25 kV AC overhead catenary masts, and a radiant 3D sun with corona halo.
- **Procedural Audio**: Authentic dual-tone locomotive horn synthesized via Web Audio API (311 Hz + 370 Hz).
- **Mobile Optimized**: Automatically hidden on mobile screens (`< 768px`) with paused WebGL render loops to ensure 0% battery/GPU overhead on phones.

### 🔍 Deep Train Modals & Insights
- **Coach Layout & Berth Visualizer**: Interactive coach berth map (Lower, Middle, Upper, Side Lower, Side Upper).
- **Live Train Schedule & Platform Map**: Detailed stop-by-stop halts, arrival/departure schedules, and intermediate distances.
- **Official Fare Breakdown**: Itemized fare calculation (Base Fare, Superfast Surcharge, Reservation Fee, GST).

---

## 🏛️ System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   React 19 Frontend                      │
│        (Vite + TypeScript + Tailwind v4 + Three.js)       │
└────────────────────────────┬─────────────────────────────┘
                             │
            HTTP / SSE Stream│  VITE_API_URL
                             ▼
┌──────────────────────────────────────────────────────────┐
│                    FastAPI Backend                       │
│                 (Python 3.11 / Uvicorn)                  │
└──────────────┬─────────────────────────────┬─────────────┘
               │                             │
┌──────────────▼─────────────┐ ┌─────────────▼─────────────┐
│    8,566 Railway Stations  │ │  Public IRCTC Live Engine │
│  & Haversine Corridor Hubs │ │  & Availability Scraper   │
└────────────────────────────┘ └───────────────────────────┘
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- **Node.js**: v18.0+ & npm
- **Python**: 3.10+ & virtualenv

### 1. Backend Setup
```bash
# Clone the repository
git clone https://github.com/TechyCSR/Irctc-Agent.git
cd Irctc-Agent

# Setup Python virtual environment
python3 -m venv venv
source venv/bin/activate

# Install backend dependencies
pip install -r backend/requirements.txt

# Run FastAPI development server
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```
*Backend API Swagger docs available at:* `http://localhost:8000/docs`

### 2. Frontend Setup
```bash
# Navigate to frontend folder
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```
*Frontend application available at:* `http://localhost:3000`

---

## 🌐 Independent Deployment

The frontend and backend are completely decoupled and deploy independently.

### Backend Deployment (Docker / Render / Railway / Fly.io)
- **Root Directory**: `backend/`
- **Port**: Set by `PORT` environment variable (defaults to `8000`)
- **CORS**: Set `CORS_ORIGINS` to your frontend domain (e.g. `https://irctc-agent.vercel.app` or `*`)

**Docker build & run:**
```bash
docker build -f backend/Dockerfile -t irctc-agent-backend .
docker run -p 8000:8000 -e CORS_ORIGINS="*" irctc-agent-backend
```

### Frontend Deployment (Vercel / Cloudflare Pages / Netlify)
- **Root Directory**: `frontend/`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Environment Variable**: `VITE_API_URL=https://your-backend-api.onrender.com`

---

## 🔌 API Reference

| Endpoint | Method | Description |
| :--- | :---: | :--- |
| `/api/stations/search?q={query}` | `GET` | Autocomplete across all 8,566 Indian stations by code, name, or city. |
| `/api/search?from={code}&to={code}&date={DD-MM-YYYY}` | `GET` | Returns scored direct and 1-transfer itineraries with live seat counts. |
| `/api/search/stream?from={code}&to={code}&date={DD-MM-YYYY}` | `GET` | SSE stream yielding direct trains first, followed by corridor connections. |
| `/api/trains/{train_no}/schedule` | `GET` | Fetches halt platform schedule, timings, and route distance. |
| `/api/trains/{train_no}/coaches` | `GET` | Fetches coach composition and berth configurations. |
| `/api/trains/{train_no}/fare` | `GET` | Computes itemized official ticket fares across coach classes. |

---

## 🛡️ License

This project is licensed under the [MIT License](LICENSE) &copy; 2026 TechyCSR.

---

## 👨‍💻 Developed By

Crafted with care by **[@TechyCSR](https://techycsr.dev)**.
Feel free to open an issue or contribute PRs!

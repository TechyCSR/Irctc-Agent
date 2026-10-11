"""
FastAPI Server for Public Universal IRCTC Agent & Smart Pathfinder.
Provides REST and Server-Sent Events (SSE) streaming APIs, station autocomplete,
and serves the React production web application.
"""

import asyncio
import json
import logging
import os
import sys
from datetime import datetime, timedelta
from typing import Optional

_current_dir = os.path.dirname(os.path.abspath(__file__))
_backend_dir = os.path.dirname(_current_dir)
_root_dir = os.path.dirname(_backend_dir)
for p in [_root_dir, _backend_dir, _current_dir]:
    if p not in sys.path:
        sys.path.insert(0, p)

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

try:
    from backend.app.engine import PublicSearchEngine
    from backend.app.stations import STATIONS_DATA, search_stations
    from backend.app.cache import search_cache, schedule_cache, multidate_cache
    from backend.app.watchdog import watchdog_manager, calculate_charting_status
except ImportError:
    from app.engine import PublicSearchEngine
    from app.stations import STATIONS_DATA, search_stations
    from app.cache import search_cache, schedule_cache, multidate_cache
    from app.watchdog import watchdog_manager, calculate_charting_status

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("IrctcAgent.API")

app = FastAPI(
    title="IRCTC AGENT API",
    description="Public High-Performance Indian Railways Route & Live Seat Discovery Agent",
    version="2.0.0"
)

cors_origins_env = os.getenv("CORS_ORIGINS", "*")
allowed_origins = ["*"] if cors_origins_env == "*" else [o.strip() for o in cors_origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = PublicSearchEngine()


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "IRCTC Universal Pathfinder", "version": "2.0.0"}


@app.get("/api/stations/search")
async def autocomplete_stations(q: str = Query("", description="Station search query")):
    """Autocomplete search for any Indian railway station code, name, or city."""
    if not q or len(q.strip()) < 1:
        return []
    return search_stations(q, limit=10)


@app.get("/api/stations/popular")
async def get_popular_stations():
    """Returns top popular starting hubs for quick selection."""
    popular_codes = ["NDLS", "CSMT", "SBC", "HWH", "MAS", "SC", "ADI", "PUNE", "JU", "JP", "CNB", "PNBE"]
    results = []
    for s in STATIONS_DATA:
        if s.code in popular_codes:
            results.append({
                "code": s.code,
                "name": s.name,
                "city": s.city,
                "state": s.state,
                "cluster": s.cluster_id
            })
    return results


@app.get("/api/search")
async def search_routes(
    from_stn: str = Query(..., alias="from", description="Origin station code e.g. JU or NDLS"),
    to_stn: str = Query(..., alias="to", description="Destination station code e.g. SBC or CSMT"),
    date: str = Query(..., description="Date of journey in DD-MM-YYYY format"),
    quota: str = Query("GN", description="Quota code: GN, TQ, etc."),
    preferred_class: Optional[str] = Query(None, alias="class", description="Preferred class code e.g. 3A, 2A, SL")
):
    """
    Standard synchronous REST search endpoint returning scored and deduplicated routes.
    """
    cache_key = f"{from_stn.upper()}:{to_stn.upper()}:{date}:{quota.upper()}:{preferred_class or 'ALL'}"
    cached = await search_cache.get(cache_key)
    if cached:
        return cached

    try:
        ranked = await engine.search_all(
            origin_code=from_stn,
            dest_code=to_stn,
            doj=date,
            quota=quota,
            preferred_class=preferred_class
        )

        serialized = [engine._serialize_itin(it) for it in ranked[:60]]
        confirmed_count = sum(1 for it in ranked if it.booking_confidence == "CONFIRMED")
        lowest_fare = min((it.best_fare for it in ranked if it.best_fare > 0), default=0)

        res_payload = {
            "status": "success",
            "origin": from_stn.upper(),
            "destination": to_stn.upper(),
            "date": date,
            "total_evaluated": len(ranked),
            "total_confirmed": confirmed_count,
            "lowest_fare": lowest_fare,
            "routes": serialized
        }
        await search_cache.set(cache_key, res_payload, ttl=300)
        return res_payload
    except Exception as e:
        logger.exception("Search error")
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})


@app.get("/api/search/stream")
async def stream_search_routes(
    from_stn: str = Query(..., alias="from"),
    to_stn: str = Query(..., alias="to"),
    date: str = Query(...),
    quota: str = Query("GN")
):
    """
    High-performance Server-Sent Events (SSE) streaming search.
    Instantly returns direct trains within 300ms, then streams connecting routes as they are found.
    """
    async def event_generator():
        try:
            async for event in engine.stream_search(from_stn, to_stn, date, quota):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            logger.exception("Streaming error")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


_ct_instance = None
_SCHEDULE_CACHE = {}


def _get_ct_instance():
    global _ct_instance
    if _ct_instance is None:
        from MultiFeatures.IndianRailway import confirmtkt
        _ct_instance = confirmtkt.Confirmtkt()
    return _ct_instance


@app.get("/api/trains/{train_no}/schedule")
async def get_train_schedule(train_no: str, date: Optional[str] = Query(None)):
    """Fetch complete station stops, arrival/departure, halts, and platforms for a train."""
    clean_no = "".join(filter(str.isdigit, train_no))
    if not clean_no:
        return JSONResponse(status_code=400, content={"error": "Invalid train number"})

    use_date = date or datetime.now().strftime("%d-%m-%Y")
    cache_key = f"{clean_no}_{use_date}"
    cached = await schedule_cache.get(cache_key)
    if cached:
        return cached

    try:
        ct = _get_ct_instance()
        raw = await ct.train_schedule(int(clean_no), use_date)
        if not raw or not isinstance(raw, dict):
            return JSONResponse(status_code=404, content={"error": "Schedule not found"})

        raw_sched = raw.get("Schedule") or []
        stops = []
        for s in raw_sched:
            stops.append({
                "code": s.get("StationCode"),
                "name": s.get("StationName"),
                "arrival": s.get("ArrivalTime") or "--:--",
                "departure": s.get("DepartureTime") or "--:--",
                "halt": s.get("HaltMinutes") or "",
                "platform": s.get("ExpectedPlatformNo") or "",
                "distance_km": s.get("Distance") or "0",
                "day": s.get("Day") or 1
            })

        result = {
            "train_no": str(raw.get("TrainNo") or clean_no),
            "train_name": raw.get("TrainName") or "",
            "source": raw.get("Source") or raw.get("SourceCode"),
            "destination": raw.get("Destination") or raw.get("DestinationCode"),
            "total_duration": raw.get("TotalDuration") or "",
            "has_pantry": bool(raw.get("HasPantry")),
            "punctuality_rating": raw.get("PunctualityRating"),
            "food_rating": raw.get("FoodRating"),
            "cleanliness_rating": raw.get("CleanlinessRating"),
            "stops": stops
        }
        await schedule_cache.set(cache_key, result, ttl=86400)
        return result
    except Exception as e:
        logger.exception("Schedule lookup error")
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/api/availability/multi-date")
async def get_multi_date_availability(
    from_stn: str = Query(..., alias="from"),
    to_stn: str = Query(..., alias="to"),
    start_date: str = Query(..., description="DD-MM-YYYY format"),
    days: int = Query(5, ge=1, le=7),
    quota: str = Query("GN")
):
    """
    Checks direct availability across 5 consecutive travel dates in parallel.
    Provides instant multi-date comparison strip.
    """
    from datetime import datetime, timedelta

    md_cache_key = f"{from_stn.upper()}:{to_stn.upper()}:{start_date}:{days}:{quota.upper()}"
    cached = await multidate_cache.get(md_cache_key)
    if cached:
        return cached

    try:
        start_dt = datetime.strptime(start_date, "%d-%m-%Y")
    except Exception:
        return JSONResponse(status_code=400, content={"error": "Invalid date format. Use DD-MM-YYYY"})

    date_objs = [start_dt + timedelta(days=i) for i in range(days)]
    date_strs = [d.strftime("%d-%m-%Y") for d in date_objs]

    tasks = [
        engine.client.fetch_trains(from_stn.upper(), to_stn.upper(), d_str, quota)
        for d_str in date_strs
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    summary = []
    for d_obj, d_str, trains in zip(date_objs, date_strs, results):
        if isinstance(trains, Exception) or not trains:
            trains_list = []
        else:
            trains_list = trains

        confirmed_count = 0
        rac_count = 0
        min_fare = 999999
        best_status = "NO DIRECT TRAINS" if not trains_list else "WL / CLOSED"

        for t in trains_list:
            avail = t.get("availability") or {}
            fares = t.get("fares_by_class") or {}
            for f in fares.values():
                if 0 < f < min_fare:
                    min_fare = f

            has_avail = any(c.get("is_available") for c in avail.values())
            has_rac = any(c.get("is_rac") for c in avail.values())

            if has_avail:
                confirmed_count += 1
                best_status = "AVAILABLE"
            elif has_rac:
                rac_count += 1
                if best_status != "AVAILABLE":
                    best_status = "RAC"

        summary.append({
            "date": d_str,
            "iso_date": d_obj.strftime("%Y-%m-%d"),
            "day_name": d_obj.strftime("%a"),
            "formatted_display": d_obj.strftime("%d %b"),
            "total_direct_trains": len(trains_list),
            "confirmed_trains": confirmed_count,
            "rac_trains": rac_count,
            "status_label": best_status,
            "lowest_fare": min_fare if min_fare != 999999 else 0
        })

    response_data = {
        "from": from_stn.upper(),
        "to": to_stn.upper(),
        "quota": quota,
        "dates": summary
    }
    await multidate_cache.set(md_cache_key, response_data, ttl=300)
    return response_data


@app.get("/api/charting/status")
async def get_charting_status(
    dep_time: str = Query(..., description="Train departure time HH:MM"),
    date: str = Query(..., description="Journey date DD-MM-YYYY")
):
    """Calculates 1st & 2nd chart preparation timeline and current booking vacancy window."""
    return calculate_charting_status(dep_time, date)


@app.post("/api/watchdog/subscribe")
async def subscribe_watchdog(payload: dict):
    """Subscribes an alert for seat availability changes on a train."""
    return watchdog_manager.subscribe(
        train_no=payload.get("train_no", ""),
        doj=payload.get("doj", ""),
        from_stn=payload.get("from_stn", ""),
        to_stn=payload.get("to_stn", ""),
        travel_class=payload.get("travel_class", "3A"),
        quota=payload.get("quota", "GN"),
        target_status=payload.get("target_status", "AVAILABLE"),
        notify_channel=payload.get("notify_channel", "browser_push"),
        contact=payload.get("contact", "")
    )


@app.get("/api/watchdog/list")
async def list_watchdogs():
    """Returns active watchlist alert subscriptions."""
    return {"alerts": watchdog_manager.list_alerts()}


@app.delete("/api/watchdog/{alert_id}")
async def delete_watchdog(alert_id: str):
    """Removes an active seat watchdog alert."""
    return {"success": watchdog_manager.remove_alert(alert_id)}


# Mount React production build if available
dist_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend", "dist")
if os.path.exists(dist_dir):
    app.mount("/", StaticFiles(directory=dist_dir, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("X_ZOHO_CATALYST_LISTEN_PORT", os.getenv("PORT", 8000)))
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=port)

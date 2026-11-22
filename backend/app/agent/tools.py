"""
LangChain & Model Context Protocol (MCP) Tools for IRCTC Agent.
Provides tools to query Indian Railways schedules, seat availability,
multi-date calendars, route optimization, same-train split discovery, and fare calculations.
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from langchain_core.tools import tool

try:
    from app.engine import PublicSearchEngine, normalize_date_ddmmyyyy
    from app.stations import search_stations, STATIONS_BY_CODE, get_cluster_station_codes
    from app.rail_metadata import calculate_fare_breakdown, ALL_QUOTAS, TRAIN_CATEGORIES
    from app.watchdog import calculate_charting_status
except ImportError:
    from backend.app.engine import PublicSearchEngine, normalize_date_ddmmyyyy
    from backend.app.stations import search_stations, STATIONS_BY_CODE, get_cluster_station_codes
    from backend.app.rail_metadata import calculate_fare_breakdown, ALL_QUOTAS, TRAIN_CATEGORIES
    from backend.app.watchdog import calculate_charting_status

logger = logging.getLogger("IrctcAgent.Tools")
_engine = PublicSearchEngine()

CITY_TO_DEFAULT_CODE = {
    "DELHI": "NDLS",
    "NEW DELHI": "NDLS",
    "BANGALORE": "SBC",
    "BENGALURU": "SBC",
    "MUMBAI": "CSMT",
    "BOMBAY": "CSMT",
    "KOLKATA": "HWH",
    "CALCUTTA": "HWH",
    "CHENNAI": "MAS",
    "MADRAS": "MAS",
    "HYDERABAD": "SC",
    "SECUNDERABAD": "SC",
    "AHMEDABAD": "ADI",
    "PUNE": "PUNE",
    "JAIPUR": "JP",
    "JODHPUR": "JU",
    "LUCKNOW": "LKO",
    "KANPUR": "CNB",
    "JHANSI": "VGLJ",
    "GWALIOR": "GWL",
    "BHOPAL": "BPL",
    "PATNA": "PNBE",
    "VARANASI": "BSB",
    "CHANDIGARH": "CDG",
    "AGRA": "AGC",
}


def resolve_station_code(query: str) -> str:
    """Resolves station code from code or city name."""
    if not query:
        return ""
    q = query.strip().upper()
    if q in STATIONS_BY_CODE:
        return q
    if q in CITY_TO_DEFAULT_CODE:
        return CITY_TO_DEFAULT_CODE[q]
    matches = search_stations(query, limit=5)
    if matches:
        return matches[0]["code"]
    return q


@tool
async def search_trains(
    origin: str,
    destination: str,
    date: str,
    quota: str = "GN",
    preferred_class: Optional[str] = None,
    max_budget: Optional[int] = None,
    confirmed_only: bool = False
) -> Dict[str, Any]:
    """
    Search direct and connecting trains, same-train split seats, and point-beyond hacks between stations.
    
    Args:
        origin: Station code (e.g. NDLS, VGLJ) or city name (e.g. Delhi, Jhansi).
        destination: Station code (e.g. SBC, CSMT) or city name (e.g. Bangalore, Mumbai).
        date: Travel date in DD-MM-YYYY or YYYY-MM-DD format.
        quota: Quota code: GN (General), TQ (Tatkal), PT (Premium Tatkal), LD (Ladies), SS (Senior Citizen). Default: GN.
        preferred_class: Optional travel class code: 1A, 2A, 3A, 3E, SL, CC, EC, 2S.
        max_budget: Maximum ticket fare in INR (e.g. 1500).
        confirmed_only: If True, only returns routes with CONFIRMED seat status.
    """
    src = resolve_station_code(origin)
    dst = resolve_station_code(destination)
    if not src or not dst:
        return {
            "status": "error",
            "message": f"Could not resolve stations for origin '{origin}' or destination '{destination}'."
        }
    if src == dst:
        return {
            "status": "error",
            "message": "Origin and destination stations cannot be the same."
        }

    norm_date = normalize_date_ddmmyyyy(date)

    try:
        ranked = await _engine.search_all(
            origin_code=src,
            dest_code=dst,
            doj=norm_date,
            quota=quota,
            preferred_class=preferred_class
        )

        # Apply filtering
        filtered = ranked
        if confirmed_only:
            filtered = [r for r in filtered if r.booking_confidence == "CONFIRMED"]
        if max_budget and max_budget > 0:
            filtered = [r for r in filtered if r.best_fare > 0 and r.best_fare <= max_budget]

        serialized = [_engine._serialize_itin(it, quota=quota) for it in filtered[:25]]
        confirmed_count = sum(1 for it in ranked if it.booking_confidence == "CONFIRMED")
        lowest_fare = min((it.best_fare for it in ranked if it.best_fare > 0), default=0)

        return {
            "status": "success",
            "origin": src,
            "destination": dst,
            "date": norm_date,
            "quota": quota,
            "total_evaluated": len(ranked),
            "matching_routes_count": len(filtered),
            "confirmed_count": confirmed_count,
            "lowest_fare": lowest_fare,
            "routes": serialized
        }
    except Exception as e:
        logger.exception("search_trains error")
        return {"status": "error", "message": str(e)}


@tool
async def resolve_station(station_name: str) -> Dict[str, Any]:
    """
    Look up station details (station code, full name, city, state) for any Indian railway station or city.
    
    Args:
        station_name: Station code, full station name, or city (e.g. 'Jhansi', 'Bangalore', 'VGLJ').
    """
    matches = search_stations(station_name, limit=10)
    return {
        "query": station_name,
        "count": len(matches),
        "matches": matches
    }


@tool
async def get_train_schedule(train_no: str, date: Optional[str] = None) -> Dict[str, Any]:
    """
    Fetch complete station stops, timetable, arrival/departure times, halts, and platforms for a train.
    
    Args:
        train_no: 5-digit Indian Railways train number (e.g. '12628', '22692').
        date: Optional journey date in DD-MM-YYYY format.
    """
    clean_no = "".join(filter(str.isdigit, train_no))
    if not clean_no:
        return {"error": "Invalid train number. Must contain digits."}

    try:
        from MultiFeatures.IndianRailway import confirmtkt
        ct = confirmtkt.Confirmtkt()
        use_date = normalize_date_ddmmyyyy(date) if date else datetime.now().strftime("%d-%m-%Y")
        raw = await ct.train_schedule(int(clean_no), use_date)
        if not raw or not isinstance(raw, dict):
            return {"error": f"Schedule not found for train {clean_no}."}

        stops = []
        for s in (raw.get("Schedule") or []):
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

        return {
            "train_no": str(raw.get("TrainNo") or clean_no),
            "train_name": raw.get("TrainName") or "",
            "source": raw.get("Source") or raw.get("SourceCode"),
            "destination": raw.get("Destination") or raw.get("DestinationCode"),
            "total_duration": raw.get("TotalDuration") or "",
            "has_pantry": bool(raw.get("HasPantry")),
            "total_stops": len(stops),
            "stops": stops
        }
    except Exception as e:
        logger.exception("get_train_schedule error")
        return {"error": str(e)}


@tool
async def get_multi_date_availability(
    origin: str,
    destination: str,
    start_date: str,
    days: int = 5,
    quota: str = "GN"
) -> Dict[str, Any]:
    """
    Check seat availability across consecutive dates in parallel (up to 7 days).
    Useful to answer 'is there availability on next day or this weekend?'.
    
    Args:
        origin: Station code (e.g. NDLS).
        destination: Station code (e.g. SBC).
        start_date: Start date in DD-MM-YYYY or YYYY-MM-DD format.
        days: Number of consecutive days to check (1 to 7, default 5).
        quota: Quota code (GN, TQ, etc.).
    """
    src = resolve_station_code(origin)
    dst = resolve_station_code(destination)
    norm_start_date = normalize_date_ddmmyyyy(start_date)

    try:
        start_dt = datetime.strptime(norm_start_date, "%d-%m-%Y")
    except Exception:
        return {"error": "Invalid date format. Expected DD-MM-YYYY."}

    days = max(1, min(7, days))
    date_objs = [start_dt + timedelta(days=i) for i in range(days)]
    date_strs = [d.strftime("%d-%m-%Y") for d in date_objs]

    tasks = [_engine.client.fetch_trains(src, dst, d_str, quota) for d_str in date_strs]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    summary = []
    for d_obj, d_str, trains in zip(date_objs, date_strs, results):
        trains_list = [] if isinstance(trains, Exception) or not trains else trains
        confirmed_count = 0
        rac_count = 0
        min_fare = 999999

        for t in trains_list:
            avail = t.get("availability") or {}
            fares = t.get("fares_by_class") or {}
            for f in fares.values():
                if 0 < f < min_fare:
                    min_fare = f
            if any(c.get("is_available") for c in avail.values()):
                confirmed_count += 1
            elif any(c.get("is_rac") for c in avail.values()):
                rac_count += 1

        status_label = "AVAILABLE" if confirmed_count > 0 else ("RAC" if rac_count > 0 else "WL / CLOSED")
        summary.append({
            "date": d_str,
            "iso_date": d_obj.strftime("%Y-%m-%d"),
            "day": d_obj.strftime("%a, %d %b"),
            "direct_trains": len(trains_list),
            "confirmed_trains": confirmed_count,
            "status": status_label,
            "lowest_fare": min_fare if min_fare != 999999 else 0
        })

    return {
        "origin": src,
        "destination": dst,
        "dates_checked": summary
    }


@tool
async def get_fare_breakdown(fare: int, travel_class: str = "3A") -> Dict[str, Any]:
    """
    Calculate the official IRCTC fare breakdown (base fare, reservation fee, superfast surcharge, GST).
    
    Args:
        fare: Total ticket fare in INR.
        travel_class: Class code (e.g. 1A, 2A, 3A, 3E, SL, CC, EC, 2S).
    """
    return calculate_fare_breakdown(fare, travel_class)


@tool
async def get_charting_status(dep_time: str, date: str) -> Dict[str, Any]:
    """
    Calculate 1st & 2nd chart preparation timeline and current booking vacancy window for a train.
    
    Args:
        dep_time: Train departure time in HH:MM format (24-hour).
        date: Journey date in DD-MM-YYYY or YYYY-MM-DD.
    """
    norm_date = normalize_date_ddmmyyyy(date)
    return calculate_charting_status(dep_time, norm_date)


RAIL_KNOWLEDGE_BASE = {
    "tatkal": {
        "title": "IRCTC Tatkal & Premium Tatkal Rules",
        "points": [
            "Opening Timings: AC classes (1A, 2A, 3A, 3E, CC, EC) open at 10:00 AM IST; Non-AC classes (SL, 2S) open at 11:00 AM IST one day prior to journey date from train origin.",
            "Maximum 4 passengers permitted per Tatkal PNR.",
            "No concession allowed under Tatkal/Premium Tatkal quotas.",
            "Zero refund on cancellation of confirmed Tatkal tickets.",
            "Premium Tatkal (PT) charges dynamic fares that escalate with booking demand; no RAC or Waitlist in PT."
        ]
    },
    "cancellation": {
        "title": "IRCTC Ticket Cancellation & Refund Slabs",
        "points": [
            "48+ hours before departure: Flat clerkage deduction — 1A/EC: ₹240, 2A: ₹200, 3A/3E/CC: ₹180, SL: ₹120, 2S: ₹60 per passenger.",
            "Between 48 hours & 12 hours before departure: 25% of fare (subject to minimum clerkage).",
            "Between 12 hours & 4 hours (or chart preparation): 50% of fare deducted.",
            "After Chart Preparation (< 4 hours): No refund on confirmed tickets; TDR must be filed online for exceptional cancellations."
        ]
    },
    "charting": {
        "title": "Chart Preparation & Current Booking Vacancy",
        "points": [
            "First Chart: Finalized at least 4 hours before the scheduled train departure from originating station (or previous evening at 20:00 for trains leaving before 08:00 AM).",
            "Second Chart: Prepared 30 minutes before departure after re-allocating vacant berths or short cancellations.",
            "Current Booking: Unsold vacant berths after 1st chart are available at a 10% discount on base fare until 30 minutes prior to departure."
        ]
    },
    "rac": {
        "title": "RAC (Reservation Against Cancellation) Rules",
        "points": [
            "An RAC ticket guarantees entry onto the train and provides a shared lower berth with another passenger.",
            "If confirmed passengers cancel or don't board, RAC passengers are promoted to full berths automatically in order of seniority.",
            "Bedrolls are provided to RAC passengers in all AC classes."
        ]
    },
    "luggage": {
        "title": "Indian Railways Baggage Allowance",
        "points": [
            "AC First (1A): 70 kg free allowance, maximum 150 kg with nominal excess charge.",
            "AC 2-Tier (2A): 50 kg free allowance, maximum 100 kg.",
            "AC 3-Tier / Chair Car (3A/3E/CC): 40 kg free allowance, maximum 40 kg.",
            "Sleeper Class (SL): 40 kg free allowance, maximum 80 kg.",
            "Second Class (2S): 35 kg free allowance, maximum 70 kg."
        ]
    }
}


@tool
async def web_search_rail_intel(query: str) -> Dict[str, Any]:
    """
    Search live web information, IRCTC circulars, Tatkal rules, cancellation charges,
    fog delay bulletins, platform numbers, and Indian Railways travel guidelines.
    
    Args:
        query: Specific search query (e.g. "tatkal booking opening time rules", "IRCTC cancellation charges slab 2026", "Vande Bharat luggage limit").
    """
    lower = query.lower()
    matched_points = []
    category = "General Railway Intelligence"

    for key, data in RAIL_KNOWLEDGE_BASE.items():
        if key in lower or any(word in lower for word in key.split()):
            category = data["title"]
            matched_points.extend(data["points"])

    # If no specific rule matched, check broader keywords
    if not matched_points:
        if "refund" in lower or "cancel" in lower:
            category = RAIL_KNOWLEDGE_BASE["cancellation"]["title"]
            matched_points = RAIL_KNOWLEDGE_BASE["cancellation"]["points"]
        elif "time" in lower or "chart" in lower:
            category = RAIL_KNOWLEDGE_BASE["charting"]["title"]
            matched_points = RAIL_KNOWLEDGE_BASE["charting"]["points"]
        else:
            category = "IRCTC Official Travel Guidelines"
            matched_points = [
                "Tatkal AC booking opens at 10:00 AM; Sleeper/Non-AC opens at 11:00 AM one day before origin departure.",
                "First charting occurs 4 hours prior to departure; second charting occurs 30 minutes prior.",
                "Unsold vacant berths post-charting can be booked directly online via 'Current Booking'.",
                "Senior citizen lower berth quotas (SS) are reserved for men 60+ and women 45+ traveling solo.",
                "Same-train split ticket booking allows passengers to reserve consecutive legs on the same train when direct end-to-end seats are waitlisted."
            ]

    # Quick external search probe if query is specific and network permits
    external_snippet = None
    try:
        import urllib.request
        import urllib.parse
        encoded = urllib.parse.quote_plus(f"irctc indian railways {query}")
        req = urllib.request.Request(
            f"https://html.duckduckgo.com/html/?q={encoded}",
            headers={"User-Agent": "Mozilla/5.0 (compatible; IrctcAgent/2.0)"}
        )
        # Fast non-blocking timeout
        loop = asyncio.get_event_loop()
        def _fetch():
            with urllib.request.urlopen(req, timeout=2.5) as resp:
                return resp.read().decode("utf-8", errors="ignore")
        html = await loop.run_in_executor(None, _fetch)
        import re
        snippets = re.findall(r'<a class="result__snippet[^>]*>(.*?)</a>', html, re.DOTALL)
        if snippets:
            clean_snippet = re.sub(r'<[^>]+>', '', snippets[0]).strip()
            if len(clean_snippet) > 30:
                external_snippet = clean_snippet
    except Exception:
        pass

    return {
        "query": query,
        "category": category,
        "key_points": matched_points,
        "web_snippet": external_snippet,
        "source": "Indian Railways / IRCTC Guidelines & Live Web Intelligence"
    }


ALL_AGENT_TOOLS = [
    search_trains,
    resolve_station,
    get_train_schedule,
    get_multi_date_availability,
    get_fare_breakdown,
    get_charting_status,
    web_search_rail_intel,
]

TOOLS_BY_NAME = {t.name: t for t in ALL_AGENT_TOOLS}


def get_mcp_tools_manifest() -> List[Dict[str, Any]]:
    """Generates standard Model Context Protocol (MCP) tool schema specifications."""
    manifest = []
    for t in ALL_AGENT_TOOLS:
        args_schema = {}
        if hasattr(t, "args_schema") and t.args_schema:
            try:
                schema = t.args_schema.model_json_schema()
                args_schema = {
                    "type": "object",
                    "properties": schema.get("properties", {}),
                    "required": schema.get("required", [])
                }
            except Exception:
                args_schema = {"type": "object", "properties": {}}

        manifest.append({
            "name": t.name,
            "description": t.description or "",
            "inputSchema": args_schema
        })
    return manifest

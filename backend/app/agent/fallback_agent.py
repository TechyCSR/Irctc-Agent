"""
Smart Heuristic & Rule-Based Fallback Agent for IRCTC Agent.
Provides robust natural language understanding and tool dispatch even when
no external LLM API key (OpenAI/Gemini/Ollama) is configured.
"""

import re
from datetime import datetime, timedelta
from typing import Any, AsyncGenerator, Dict, List, Optional, Tuple

try:
    from app.agent.tools import (
        search_trains,
        resolve_station,
        get_train_schedule,
        get_multi_date_availability,
        get_charting_status,
        resolve_station_code,
        CITY_TO_DEFAULT_CODE
    )
    from app.engine import normalize_date_ddmmyyyy
except ImportError:
    from backend.app.agent.tools import (
        search_trains,
        resolve_station,
        get_train_schedule,
        get_multi_date_availability,
        get_charting_status,
        resolve_station_code,
        CITY_TO_DEFAULT_CODE
    )
    from backend.app.engine import normalize_date_ddmmyyyy

MONTHS = {
    "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
    "apr": 4, "april": 4, "may": 5, "june": 6, "jun": 6, "july": 7, "jul": 7,
    "aug": 8, "august": 8, "sep": 9, "september": 9, "oct": 10, "october": 10,
    "nov": 11, "november": 11, "dec": 12, "december": 12
}


def parse_date_from_text(text: str) -> Optional[str]:
    """Extracts a travel date from natural text query."""
    lower = text.lower()
    now = datetime.now()

    if "tomorrow" in lower:
        d = now + timedelta(days=1)
        return d.strftime("%d-%m-%Y")
    if "today" in lower:
        return now.strftime("%d-%m-%Y")
    if "day after tomorrow" in lower:
        d = now + timedelta(days=2)
        return d.strftime("%d-%m-%Y")

    # Match DD-MM-YYYY or DD/MM/YYYY
    match_dmy = re.search(r"\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b", text)
    if match_dmy:
        day, month, year = match_dmy.groups()
        return f"{day.zfill(2)}-{month.zfill(2)}-{year}"

    # Match YYYY-MM-DD
    match_ymd = re.search(r"\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b", text)
    if match_ymd:
        year, month, day = match_ymd.groups()
        return f"{day.zfill(2)}-{month.zfill(2)}-{year}"

    # Match "28 dec", "28th december", "4 dec 2026"
    match_month = re.search(r"\b(\d{1,2})(?:st|nd|rd|th)?\s+([a-zA-Z]{3,9})(?:\s+(\d{4}))?\b", lower)
    if match_month:
        day_str, month_name, year_str = match_month.groups()
        month_num = MONTHS.get(month_name[:3])
        if month_num:
            day = int(day_str)
            year = int(year_str) if year_str else now.year
            # If date has already passed this year, assume next year
            try:
                candidate = datetime(year, month_num, day)
                if candidate < now - timedelta(days=1) and not year_str:
                    year += 1
                return f"{str(day).zfill(2)}-{str(month_num).zfill(2)}-{year}"
            except ValueError:
                pass

    return None


def parse_budget_from_text(text: str) -> Optional[int]:
    """Extracts budget limit e.g. 'under 1500', '< 1200', 'less than 2000'."""
    lower = text.lower()
    match = re.search(r"(?:under|below|less than|budget|max|within|upto|up to|₹|<)\s*(\d{3,5})", lower)
    if match:
        return int(match.group(1))
    return None


def parse_class_from_text(text: str) -> Optional[str]:
    """Extracts preferred travel class."""
    lower = text.lower()
    if re.search(r"\b(1a|first ac|1st ac)\b", lower):
        return "1A"
    if re.search(r"\b(2a|2ac|2 tier|second ac)\b", lower):
        return "2A"
    if re.search(r"\b(3a|3ac|3 tier|third ac)\b", lower):
        return "3A"
    if re.search(r"\b(3e|3ac economy|economy ac)\b", lower):
        return "3E"
    if re.search(r"\b(sl|sleeper)\b", lower):
        return "SL"
    if re.search(r"\b(cc|chair car)\b", lower):
        return "CC"
    if re.search(r"\b(ec|exec|executive)\b", lower):
        return "EC"
    if re.search(r"\b(2s|second seating)\b", lower):
        return "2S"
    return None


def parse_quota_from_text(text: str) -> str:
    """Extracts quota."""
    lower = text.lower()
    if "tatkal" in lower and "premium" in lower:
        return "PT"
    if "tatkal" in lower:
        return "TQ"
    if "ladies" in lower:
        return "LD"
    if "senior" in lower or "lower berth" in lower:
        return "SS"
    if "foreign" in lower or "tourist" in lower:
        return "FT"
    return "GN"


def extract_station_pair(text: str) -> Tuple[Optional[str], Optional[str]]:
    """Extracts from and to station names/cities."""
    # Pattern: "from X to Y"
    match = re.search(r"from\s+([a-zA-Z\s]{2,20}?)\s+to\s+([a-zA-Z\s]{2,20}?)(?:\s+(?:on|for|in|under|between|with|date|by)|$|[,\.\?!])", text, re.IGNORECASE)
    if match:
        return match.group(1).strip(), match.group(2).strip()

    # Pattern: "X to Y"
    match2 = re.search(r"\b([a-zA-Z]{3,15})\s+to\s+([a-zA-Z]{3,15})\b", text, re.IGNORECASE)
    if match2:
        return match2.group(1).strip(), match2.group(2).strip()

    # Pattern: "between X and Y"
    match3 = re.search(r"between\s+([a-zA-Z\s]{2,20}?)\s+and\s+([a-zA-Z\s]{2,20}?)(?:\s+|$)", text, re.IGNORECASE)
    if match3:
        return match3.group(1).strip(), match3.group(2).strip()

    return None, None


class SmartFallbackAgent:
    """
    Autonomous fallback conversational agent that executes Indian Railway tools
    and generates helpful structured responses without requiring an external LLM key.
    """

    async def execute_query(self, message: str) -> Dict[str, Any]:
        """Processes the natural language query, runs tools, and formats the reply."""
        text = message.strip()
        lower = text.lower()

        steps: List[Dict[str, Any]] = []
        routes: List[Dict[str, Any]] = []

        # 1. Greetings / Help
        greeting_words = ["hi", "hello", "hey", "help", "who are you", "what can you do", "features", "how does this work", "namaste"]
        if any(w in lower for w in greeting_words) and len(text.split()) <= 10:
            return {
                "text": (
                    "👋 **Namaste! I am your Antigravity IRCTC Copilot.**\n\n"
                    "I can help you discover confirmed Indian Railway tickets, uncover same-train split seats, check tatkal quotas, track live schedules, and optimize fares.\n\n"
                    "**Try asking me:**\n"
                    "• *'Find confirmed trains from Jhansi to Bangalore on 28 Dec under ₹1500'*\n"
                    "• *'Trains from Delhi to Mumbai tomorrow in 3A'*\n"
                    "• *'Check schedule for train 12628'*\n"
                    "• *'Compare seat availability from NDLS to SBC for the next 5 days'*\n"
                    "• *'When does the chart get prepared for 18:00 departure today?'*"
                ),
                "steps": [
                    {"label": "Understood conversation intent", "type": "thinking"}
                ],
                "routes": [],
                "suggestions": [
                    "Trains from Jhansi to Bangalore on 28 Dec under 1500",
                    "Delhi to Mumbai tomorrow 3A",
                    "Schedule for 12628",
                    "Compare 5 days NDLS to SBC"
                ]
            }

        # 2. Train Schedule Query: e.g. "schedule of 12628" or "train 12628 stops"
        train_no_match = re.search(r"\b(?:train|schedule|stops?|status)?\s*#?\s*(\d{5})\b", text)
        if train_no_match and any(k in lower for k in ["schedule", "stop", "route", "time", "reach", "platform"]):
            train_no = train_no_match.group(1)
            steps.append({
                "label": f"Fetching timetable and stops for Train #{train_no}",
                "type": "tool_call",
                "toolName": "get_train_schedule",
                "input": {"train_no": train_no}
            })
            sched = await get_train_schedule.ainvoke({"train_no": train_no})
            if "error" in sched:
                steps.append({"label": f"Schedule fetch error: {sched['error']}", "type": "error"})
                return {
                    "text": f"⚠️ Could not retrieve schedule for train **{train_no}**: {sched.get('error')}",
                    "steps": steps,
                    "routes": []
                }
            
            steps.append({"label": f"Retrieved {sched.get('total_stops', 0)} stops timetable", "type": "tool_result"})
            stops_preview = sched.get("stops", [])[:8]
            table_rows = "\n".join([f"| {s['code']} | {s['name']} | {s['arrival']} | {s['departure']} | {s['halt']} | Pf {s['platform'] or '-'} |" for s in stops_preview])
            reply = (
                f"### 🚆 {sched.get('train_name')} ({sched.get('train_no')})\n"
                f"**From:** `{sched.get('source')}` → **To:** `{sched.get('destination')}` | **Duration:** {sched.get('total_duration')} | **Pantry:** {'✅ Yes' if sched.get('has_pantry') else '❌ No'}\n\n"
                f"| Station | Name | Arr | Dep | Halt | Platform |\n"
                f"|---|---|---|---|---|---|\n"
                f"{table_rows}\n\n"
                f"*(Showing first {len(stops_preview)} of {sched.get('total_stops')} total stations)*"
            )
            return {"text": reply, "steps": steps, "routes": []}

        # 3. Charting Status Query: "charting time" or "chart preparation"
        if "chart" in lower or "charting" in lower:
            time_match = re.search(r"\b(\d{1,2}:\d{2})\b", text)
            dep_time = time_match.group(1) if time_match else "18:00"
            date = parse_date_from_text(text) or datetime.now().strftime("%d-%m-%Y")
            steps.append({
                "label": f"Calculating IRCTC charting timeline for departure at {dep_time} on {date}",
                "type": "tool_call",
                "toolName": "get_charting_status",
                "input": {"dep_time": dep_time, "date": date}
            })
            chart_info = await get_charting_status.ainvoke({"dep_time": dep_time, "date": date})
            steps.append({"label": "Charting rules applied", "type": "tool_result"})
            reply = (
                f"### 🕒 IRCTC Charting Rules & Vacancy Window\n\n"
                f"• **Departure Time:** `{chart_info.get('scheduled_departure')}`\n"
                f"• **First Chart Prep:** `{chart_info.get('first_chart_time')}` (approx 4 hours prior)\n"
                f"• **Second Chart Prep:** `{chart_info.get('second_chart_time')}` (approx 30 mins prior)\n"
                f"• **Status:** **{chart_info.get('status_label')}**\n\n"
                f"💡 **Tip:** {chart_info.get('guidance_tip')}"
            )
            return {"text": reply, "steps": steps, "routes": []}

        # 4. Multi-Date Comparison: e.g. "compare next 5 days from NDLS to SBC"
        if any(k in lower for k in ["compare", "multi date", "next 5 days", "calendar", "which day"]):
            from_raw, to_raw = extract_station_pair(text)
            if from_raw and to_raw:
                date = parse_date_from_text(text) or (datetime.now() + timedelta(days=1)).strftime("%d-%m-%Y")
                steps.append({
                    "label": f"Checking 5-day availability window for {from_raw.upper()} → {to_raw.upper()}",
                    "type": "tool_call",
                    "toolName": "get_multi_date_availability",
                    "input": {"origin": from_raw, "destination": to_raw, "start_date": date}
                })
                m_avail = await get_multi_date_availability.ainvoke({
                    "origin": from_raw,
                    "destination": to_raw,
                    "start_date": date,
                    "days": 5
                })
                steps.append({"label": "Compiled multi-date comparison", "type": "tool_result"})
                dates_list = m_avail.get("dates_checked", [])
                date_rows = "\n".join([f"| {d['day']} | **{d['status']}** | {d['confirmed_trains']} | ₹{d['lowest_fare']} |" for d in dates_list])
                reply = (
                    f"### 📅 5-Day Availability Comparison (`{m_avail.get('origin')}` → `{m_avail.get('destination')}`)\n\n"
                    f"| Date | Seat Status | Confirmed Trains | Lowest Fare |\n"
                    f"|---|---|---|---|\n"
                    f"{date_rows}\n\n"
                    f"💡 Click any date in the Direct Optimizer to see full train itineraries."
                )
                return {"text": reply, "steps": steps, "routes": []}

        # 5. Train Ticket Search (Primary Use Case)
        from_raw, to_raw = extract_station_pair(text)
        
        # If no explicit "from/to" pattern, test if well known city pairs are mentioned
        if not from_raw or not to_raw:
            found_cities = []
            for city in CITY_TO_DEFAULT_CODE.keys():
                if city.lower() in lower:
                    found_cities.append(city)
            if len(found_cities) >= 2:
                from_raw, to_raw = found_cities[0], found_cities[1]

        if not from_raw or not to_raw:
            return {
                "text": (
                    "Could you please specify your **origin** and **destination** stations or cities?\n\n"
                    "For example:\n"
                    "• *'Trains from New Delhi to Mumbai on 25 Dec'* \n"
                    "• *'From Jhansi to Bangalore on 28 Dec under 1500'*"
                ),
                "steps": [{"label": "Awaiting origin and destination station details", "type": "thinking"}],
                "routes": [],
                "suggestions": [
                    "Trains from Delhi to Mumbai tomorrow",
                    "Trains from Jhansi to Bangalore on 28 Dec",
                    "Trains from Lucknow to Bangalore under 1500"
                ]
            }

        date = parse_date_from_text(text) or (datetime.now() + timedelta(days=1)).strftime("%d-%m-%Y")
        budget = parse_budget_from_text(text)
        pref_class = parse_class_from_text(text)
        quota = parse_quota_from_text(text)
        confirmed_only = "confirm" in lower or "available" in lower

        steps.append({
            "label": f"Resolving station codes for '{from_raw}' and '{to_raw}'",
            "type": "tool_call",
            "toolName": "resolve_station",
            "input": {"origin": from_raw, "destination": to_raw}
        })
        src_code = resolve_station_code(from_raw)
        dst_code = resolve_station_code(to_raw)
        steps.append({
            "label": f"Resolved: {from_raw.title()} ({src_code}) → {to_raw.title()} ({dst_code})",
            "type": "tool_result"
        })

        steps.append({
            "label": f"Searching direct routes, split seats & transfer corridors for {date} (Quota: {quota})",
            "type": "tool_call",
            "toolName": "search_trains",
            "input": {
                "origin": src_code,
                "destination": dst_code,
                "date": date,
                "quota": quota,
                "preferred_class": pref_class,
                "max_budget": budget,
                "confirmed_only": confirmed_only
            }
        })

        search_res = await search_trains.ainvoke({
            "origin": src_code,
            "destination": dst_code,
            "date": date,
            "quota": quota,
            "preferred_class": pref_class,
            "max_budget": budget,
            "confirmed_only": confirmed_only
        })

        if search_res.get("status") == "error":
            steps.append({"label": f"Search error: {search_res.get('message')}", "type": "error"})
            return {
                "text": f"❌ Could not complete search between **{src_code}** and **{dst_code}**: {search_res.get('message')}",
                "steps": steps,
                "routes": []
            }

        found_routes = search_res.get("routes", [])
        total_eval = search_res.get("total_evaluated", 0)
        confirmed_cnt = search_res.get("confirmed_count", 0)
        lowest_fare = search_res.get("lowest_fare", 0)

        steps.append({
            "label": f"Evaluated {total_eval} routes. Found {len(found_routes)} matching options ({confirmed_cnt} confirmed seats).",
            "type": "tool_result"
        })

        # Synthesize response
        split_hacks = [r for r in found_routes if r.get("lifehack_type") == "SAME_TRAIN_SPLIT"]
        point_beyond_hacks = [r for r in found_routes if r.get("lifehack_type") == "POINT_BEYOND"]

        filter_desc = []
        if pref_class:
            filter_desc.append(f"Class: **{pref_class}**")
        if budget:
            filter_desc.append(f"Budget: **≤ ₹{budget}**")
        if confirmed_only:
            filter_desc.append("**Confirmed Only**")
        filter_str = f" ({', '.join(filter_desc)})" if filter_desc else ""

        reply_lines = [
            f"### 🎯 Found {len(found_routes)} trains from `{src_code}` to `{dst_code}` on **{date}**{filter_str}\n",
            f"• **Confirmed Available:** `{confirmed_cnt} options`",
            f"• **Lowest Fare:** `₹{lowest_fare}`",
        ]

        if split_hacks:
            reply_lines.append(f"• **💡 Same-Train Split Found:** You can split seats on `{split_hacks[0]['legs'][0]['train_no']}` to get confirmed berths on the same journey!")

        if point_beyond_hacks:
            reply_lines.append(f"• **🎫 Alternate Origin Hack:** Book from `{point_beyond_hacks[0].get('booking_origin')}` with boarding at `{src_code}` to bypass local waitlists.")

        reply_lines.append("\nHere are the top ranked itineraries with real-time seat status and fare breakdown below:")

        return {
            "text": "\n".join(reply_lines),
            "steps": steps,
            "routes": found_routes,
            "suggestions": [
                f"Show cheapest sleeper under 1000",
                f"Check availability for next day",
                f"Are there confirmed 3AC berths?",
                f"Show schedule for {found_routes[0]['legs'][0]['train_no']}" if found_routes else "Show schedule"
            ]
        }

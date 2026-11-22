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
        web_search_rail_intel,
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
        web_search_rail_intel,
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
    """Extracts a travel date from natural text query including slang/abbreviations."""
    lower = text.lower()
    now = datetime.now()

    # Day after tomorrow slang
    if any(w in lower for w in ["day after tomorrow", "dat", "day after tmrw", "day after tomor"]):
        d = now + timedelta(days=2)
        return d.strftime("%d-%m-%Y")

    # Tomorrow slang: tomorrow, tomor, tmrw, tomo, 2moro, 2morrow, tomrw
    if re.search(r"\b(tomorrow|tomor|tmrw|tomo|2moro|2morrow|tomrw)\b", lower):
        d = now + timedelta(days=1)
        return d.strftime("%d-%m-%Y")

    # Today slang: today, tdy, tonight, curren, current
    if re.search(r"\b(today|tdy|tonight|curren|current)\b", lower):
        return now.strftime("%d-%m-%Y")

    # Day names: e.g. "on friday", "this saturday", "next sunday"
    weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    for i, w in enumerate(weekdays):
        if re.search(rf"\b(on\s+|this\s+|next\s+)?{w}\b", lower):
            days_ahead = (i - now.weekday() + 7) % 7
            if days_ahead == 0:
                days_ahead = 7
            target_date = now + timedelta(days=days_ahead)
            return target_date.strftime("%d-%m-%Y")

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
    """Extracts from and to station names/cities with automatic word cleaning."""
    clean_words = r"\b(tomorrow|tomor|tmrw|tomo|2moro|today|tdy|tonight|next|curren|current|train|trains|ticket|tickets|fast|express|stops?|station|city|confirmed|seat|seats|berth|quota|tatkal|under|\d+)\b"

    def sanitize(station_str: str) -> str:
        s = re.sub(clean_words, "", station_str, flags=re.IGNORECASE).strip()
        s = re.sub(r"[^\w\s]", "", s).strip()
        return s

    # Pattern: "from X to Y"
    match = re.search(
        r"from\s+([a-zA-Z\s]{2,25}?)\s+to\s+([a-zA-Z\s]{2,25}?)(?:\s+(?:on|for|in|under|between|with|date|by|tomorrow|tomor|tmrw|today|day|confirmed|tatkal|quota|next|\d)|$|[,\.\?!])",
        text,
        re.IGNORECASE,
    )
    if match:
        f = sanitize(match.group(1))
        t = sanitize(match.group(2))
        if f and t:
            return f, t

    # Pattern: "X to Y"
    match2 = re.search(r"\b([a-zA-Z]{3,20})\s+to\s+([a-zA-Z\s]{3,20})\b", text, re.IGNORECASE)
    if match2:
        f = sanitize(match2.group(1))
        t = sanitize(match2.group(2))
        if f and t:
            return f, t

    # Pattern: "between X and Y"
    match3 = re.search(
        r"between\s+([a-zA-Z\s]{2,25}?)\s+and\s+([a-zA-Z\s]{2,25}?)(?:\s+(?:on|for|in|under|tomorrow|tomor|today|day|next|\d)|$|[,\.\?!])",
        text,
        re.IGNORECASE,
    )
    if match3:
        f = sanitize(match3.group(1))
        t = sanitize(match3.group(2))
        if f and t:
            return f, t

    return None, None


RAILWAY_JOKES = [
    (
        "Here's one every Indian train traveler knows in their soul! 🚆😂\n\n"
        "**The Universal Lower Berth Gravity Law:**\n"
        "The exact second the train leaves the platform, an Uncle ji appears with a pained expression:\n"
        "> *\"Beta, meri kamar me thoda dard hai... kya tum upper berth pe adjust kar loge please?\"* 🧳\n\n"
        "And just like that, your confirmed lower berth becomes a charity donation to humanity!"
    ),
    (
        "The Great Indian Extension Board Tournament! 🔌⚡\n\n"
        "In a Sleeper coach with 72 passengers and only 2 working charging points:\n"
        "One genius brings a 3-pin adapter, another plugs in an extension board, and by midnight "
        "there are 14 phones, 3 power banks, and someone's electric kettle running on a single 220V railway socket! 📱🤣"
    ),
    (
        "The 2-Minute Halt Water Sprint! 🏃‍♂️💨\n\n"
        "Train halts at an intermediate station for exactly 120 seconds.\n"
        "40 passengers jump down like Olympic sprinters carrying 3 empty Bisleri bottles each to reach the lone station tap, "
        "while the guard already blows the whistle at second 45! The greatest cardio workout in India! 🚰😂"
    ),
    (
        "The Philosophical Meaning of RAC: 🧘‍♂️🚆\n\n"
        "In Western philosophy, you seek your other half in romance.\n"
        "In Indian Railways, you find your other half on Side Lower 7 with an unknown stranger named Sharma ji, "
        "who by 10 PM has shared his entire life story, his daughter's wedding video, and 4 homemade theplas with you! 🫓"
    ),
    (
        "The Platform Shift Announcement: 📢🏃\n\n"
        "You struggle with 4 heavy trolleys, 2 kids, and 3 backpacks up the foot-over-bridge to Platform 1.\n"
        "The exact second you step onto Platform 1, the loudspeakers chime:\n"
        "> *\"Kripya dhyan dein... Gadi sankhya 12628... Platform kramank 1 ke sthan par Platform 8 par aayegi!\"* 💀\n\n"
        "Olympic sprint coaches should scout Indian railway stations!"
    ),
    (
        "The IRCTC Chart Preparation Ritual: 🕒📈\n\n"
        "Checking PNR status at 3:58 PM for a 4:00 PM chart preparation:\n"
        "• Refresh 1: WL 45\n"
        "• Refresh 2: WL 45\n"
        "• Refresh 3 (4:00 PM): *Server Busy / Session Expired!* 🤯\n"
        "The adrenaline rush is higher than any suspense thriller film! 🍿"
    ),
    (
        "The Middle Berth Suspension Bridge: ⛓️🛌\n\n"
        "Lower berth passengers want to chat until 11:30 PM.\n"
        "Upper berth passenger wants to climb up at 8:00 PM.\n"
        "And the Middle berth person is standing in the aisle at 9:00 PM looking like an unfolded ironing board waiting for permission to exist! 😂"
    ),
    (
        "The 3 AM Phantom Chaiwala: ☕👻\n\n"
        "Outside temperature: 8°C. Coach lights: Off. Entire coach: Fast asleep.\n"
        "Suddenly at 3:15 AM between two pitch-black stations, a silhouette walks down the aisle whispering with intense urgency:\n"
        "> *\"Chai... Chai-garam... Chai...\"* ☕\n\n"
        "Where did he board? Where is he going? Nobody knows. He is eternal."
    )
]


class SmartFallbackAgent:
    """
    Autonomous context-aware conversational agent that executes Indian Railway tools,
    tracks multi-turn session memory, handles slang/typos, and generates lively non-deterministic replies.
    """

    async def execute_query(
        self,
        message: str,
        messages_history: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """Processes the natural language query with full conversational history, runs tools, and formats the reply."""
        text = message.strip()
        lower = text.lower()
        clean_text = re.sub(r"[^\w\s]", "", lower).strip()
        messages_history = messages_history or []

        # =========================================================================
        # 0. MULTI-TURN CONTEXT MEMORY RECOVERY
        # =========================================================================
        prev_topic = None
        prev_src = None
        prev_dst = None
        prev_date = None
        jokes_already_told = []

        for m in messages_history:
            role = m.get("role", "")
            content = m.get("content", "")
            lower_m = content.lower()

            # If user or assistant talked about jokes
            if any(w in lower_m for w in ["joke", "jokes", "funny", "laugh", "chutkula", "hasao"]):
                prev_topic = "JOKE"

            # Check if any jokes were already delivered
            for idx, j_text in enumerate(RAILWAY_JOKES):
                first_line = j_text.split("\n")[0].lower()
                clean_first_line = re.sub(r"[^\w\s]", "", first_line)[:25]
                clean_m = re.sub(r"[^\w\s]", "", lower_m)
                if clean_first_line and clean_first_line in clean_m:
                    jokes_already_told.append(idx)
                    prev_topic = "JOKE"
                elif ("lower berth" in clean_m or "gravity law" in clean_m) and idx == 0:
                    jokes_already_told.append(0)
                    prev_topic = "JOKE"

            # Check if previous turn had train search
            if role == "assistant" and "Found" in content and "trains from" in content:
                prev_topic = "SEARCH_TRAINS"
                m_stn = re.search(r"from\s+`([A-Z0-9]+)`\s+to\s+`([A-Z0-9]+)`(?:\s+on\s+\*\*([0-9\-]+)\*\*)?", content)
                if m_stn:
                    prev_src, prev_dst = m_stn.group(1), m_stn.group(2)
                    if m_stn.group(3):
                        prev_date = m_stn.group(3)

        # Dynamic time-of-day greeting
        hour = datetime.now().hour
        time_greeting = "Good morning" if 5 <= hour < 12 else "Good afternoon" if 12 <= hour < 17 else "Good evening"

        # Check if user says "another one", "one more", "tell another", "aanother one"
        is_another_request = bool(re.search(r"\b(a*nother(\s+(one|joke|train|route))?|one\s+more|tell\s+another|next\s+one|more\s+jokes?|aur\s+batao|ek\s+aur)\b", clean_text))
        is_joke_request = bool(re.search(r"\b(tell\s+me\s+a\s+joke|joke|jokes|make\s+me\s+laugh|something\s+funny|funny\s+incident|chutkula)\b", clean_text))

        # =========================================================================
        # 1. JOKES & "ANOTHER ONE" MULTI-TURN LOGIC
        # =========================================================================
        if is_joke_request or (is_another_request and (prev_topic == "JOKE" or len(jokes_already_told) > 0 or not prev_topic)):
            available_indices = [i for i in range(len(RAILWAY_JOKES)) if i not in jokes_already_told]
            if not available_indices:
                available_indices = list(range(len(RAILWAY_JOKES)))
            import random
            joke_idx = random.choice(available_indices)
            selected_joke = RAILWAY_JOKES[joke_idx]
            return {
                "text": selected_joke,
                "steps": [],
                "routes": [],
                "suggestions": [
                    "Tell me another railway joke",
                    "Delhi to Jodhpur tomorrow in 3A",
                    "What is difference between 3E and 3A?",
                    "Check chart preparation time"
                ]
            }

        steps: List[Dict[str, Any]] = []
        routes: List[Dict[str, Any]] = []

        # =========================================================================
        # 2. GENERAL CONVERSATION & CHITCHAT (Zero Tools, Natural Friendly Assistant)
        # =========================================================================

        # A. Identity / Name / Creator
        if re.search(r"\b(what(s|\s+is)?\s+your\s+name|who\s+are\s+you|who\s+made\s+you|who\s+created\s+you|what\s+are\s+you|your\s+name)\b", clean_text):
            return {
                "text": (
                    f"👋 **Namaste and {time_greeting}! I am IRCTC AGENT.**\n\n"
                    "I am your autonomous Indian Railways travel assistant and ticket intelligence engine. "
                    "I can help you:\n"
                    "• 🎫 **Discover Confirmed Tickets:** Find direct trains, same-train split-seat hacks, and alternate boarding routes.\n"
                    "• ⚡ **Tatkal & Quotas:** Check Tatkal timings, Premium Tatkal surge rules, Ladies, and Senior Citizen quotas.\n"
                    "• 🕒 **Live Timetables & Schedules:** Query halts, arrival/departure times, and platform numbers.\n"
                    "• 📋 **Railway Rules & Policies:** Cancellation charges, refund rules, RAC rules, and luggage allowances.\n\n"
                    "How can I help you with your journey today?"
                ),
                "steps": [],
                "routes": [],
                "suggestions": [
                    "Trains from Delhi to Jodhpur tomorrow in 3A",
                    "From Jhansi to Bangalore on 28 Dec under 1500",
                    "What are the Tatkal booking timings and refund rules?",
                    "Compare 5-day seat availability from NDLS to SBC"
                ]
            }

        # B. Laughter / Fun / Reactions (lol, haha, lmao, etc.)
        if re.search(r"\b(lol|lmao|rofl|haha+|hehe+|xd|funny|hilarious|bhai|yaar)\b", clean_text) and not any(k in clean_text for k in ["train", "ticket", "station", "schedule", "pnr", "from", "to"]):
            laugh_replies = [
                "😄 Glad I could bring a smile! Traveling on Indian Railways is full of fun moments—from Uncle ji asking for the lower berth saying *'beta meri kamar me dard hai'*, to fighting for the lone phone charging socket in Sleeper class! 🔌🚆\n\nAre you planning a trip somewhere soon, or need help finding confirmed seats?",
                "😂 Haha! Nothing beats the chaos and charm of Indian Railways. From the 3 AM phantom chaiwala to sprinting across Platform 1 to Platform 8 in 2 minutes, every journey is an adventure! 🚂\n\nWhere are you headed next?",
                "Glad you enjoyed that! 😄 If you need tickets, Tatkal rules, or live train schedules, let me know. What journey are you planning?"
            ]
            import random
            return {
                "text": random.choice(laugh_replies),
                "steps": [],
                "routes": [],
                "suggestions": [
                    "Delhi to Jodhpur tomorrow 3A confirmed only",
                    "Jhansi to Bangalore on 28 Dec under 1500",
                    "Tell me a railway joke",
                    "What is RAC ticket?"
                ]
            }

        # C. How are you / Status
        if re.search(r"\b(how\s+are\s+you|how\s+are\s+u|hows\s+it\s+going|wassup|whats\s+up|kya\s+haal\s+hai|sab\s+badhiya)\b", clean_text):
            return {
                "text": (
                    f"I'm running on green signals and cruising right on time, just like the Vande Bharat Express! 🚅💨\n\n"
                    f"{time_greeting}! How are you doing today? Ready to plan your next rail adventure, check train availability, or verify Tatkal rules?"
                ),
                "steps": [],
                "routes": [],
                "suggestions": [
                    "Trains from Delhi to Jodhpur tomorrow in 3A",
                    "Jhansi to Bangalore on 28 Dec under 1500",
                    "When does chart prepare for today evening?"
                ]
            }

        # D. Gratitude / Appreciation
        if re.search(r"\b(thank\s+you|thanks|thx|thanku|appreciate\s+it|good\s+job|great\s+job|awesome|shukriya|dhanyawad)\b", clean_text) and not any(k in clean_text for k in ["train", "ticket", "book"]):
            return {
                "text": (
                    "You're very welcome! 😊 Always happy to assist you with Indian Railways travel.\n\n"
                    "If you need anything else—like finding another train route, checking seat probability, or reading refund rules—just ask anytime. Safe travels! 🚆✨"
                ),
                "steps": [],
                "routes": [],
                "suggestions": [
                    "Check schedule for 12628",
                    "Compare 5 days NDLS to SBC",
                    "What are the Tatkal booking timings?"
                ]
            }

        # E. Affirmations / Acknowledgments (ok, cool, sure, alright, etc.)
        if re.search(r"^(ok|okay|cool|alright|sure|got\s+it|fine|understood|yep|yeah|k|nice|perfect)$", clean_text):
            return {
                "text": (
                    "Understood! Whenever you're ready to plan your trip, just type what you need.\n\n"
                    "For example: *'Find trains from Delhi to Jodhpur tomorrow in 3A'* or *'Check Tatkal rules for AC classes'*."
                ),
                "steps": [],
                "routes": [],
                "suggestions": [
                    "Trains from Delhi to Jodhpur tomorrow 3A",
                    "Jhansi to Bangalore on 28 Dec under 1500",
                    "Check chart preparation time for 18:00 departure"
                ]
            }

        # F. Greetings / Namaste / Hi / Hello
        is_greeting = bool(re.search(r"\b(hi|hello|hey|namaste|greetings|good\s+(morning|afternoon|evening))\b", clean_text))
        has_travel_intent = bool(re.search(r"\b(from|to|train|trains|ticket|tickets|station|pnr|schedule|route|berth|seat|seats|availability|fare)\b", clean_text))
        if is_greeting and not has_travel_intent and len(text.split()) <= 6:
            return {
                "text": (
                    f"👋 **Namaste and {time_greeting}! I am IRCTC AGENT.**\n\n"
                    "I can help you discover confirmed Indian Railway tickets, uncover same-train split seats, check tatkal quotas, track live schedules, and optimize fares.\n\n"
                    "**Try asking me:**\n"
                    "• *'Find confirmed trains from Delhi to Jodhpur tomorrow in 3A'*\n"
                    "• *'Trains from Jhansi to Bangalore on 28 Dec under ₹1500'*\n"
                    "• *'Check schedule for train 12628'*\n"
                    "• *'Compare seat availability from NDLS to SBC for the next 5 days'*\n"
                    "• *'When does the chart get prepared for 18:00 departure today?'*"
                ),
                "steps": [],
                "routes": [],
                "suggestions": [
                    "Trains from Delhi to Jodhpur tomorrow 3A",
                    "Jhansi to Bangalore on 28 Dec under 1500",
                    "Schedule for 12628",
                    "Compare 5 days NDLS to SBC"
                ]
            }

        # G. Specific General Railway Concepts (Zero Tools needed, Instant accurate guidance)
        # What is RAC?
        if re.search(r"\b(what\s+is\s+rac|explain\s+rac|rac\s+rule|rac\s+meaning|rac\s+ticket)\b", clean_text):
            return {
                "text": (
                    "### 🚆 What is RAC (Reservation Against Cancellation)?\n\n"
                    "**RAC guarantees travel on the train**, but with a shared seat instead of a full sleeping berth:\n\n"
                    "1. **Seating Arrangement:** Two passengers with RAC status share one Lower Berth (the Side Lower berth in Sleeper and AC 3-Tier).\n"
                    "2. **Upgradation to Confirmed:** If any confirmed passenger cancels their ticket or does not board, the TTE upgrades RAC passengers to full berths in sequential order.\n"
                    "3. **Bedroll & Linen:** RAC passengers in AC classes (2A, 3A, 3E) are provided full complimentary bedroll and blanket.\n"
                    "4. **Cancellation Rules:** An RAC ticket can be cancelled online up to **30 minutes before scheduled train departure** with minimal clerkage fee (₹60 + GST)."
                ),
                "steps": [],
                "routes": [],
                "suggestions": [
                    "When does the first chart prepare?",
                    "What are Tatkal booking timings?",
                    "What is difference between 3E and 3A?"
                ]
            }

        # What is 3E vs 3A?
        if re.search(r"\b(difference\s+between\s+3e\s+and\s+3a|3e\s+vs\s+3a|what\s+is\s+3e|economy\s+3ac)\b", clean_text):
            return {
                "text": (
                    "### ❄️ AC 3-Tier (3A) vs AC 3-Tier Economy (3E)\n\n"
                    "| Feature | Standard AC 3-Tier (3A) | AC 3-Tier Economy (3E) |\n"
                    "|---|---|---|\n"
                    "| **Berths per Coach** | 72 berths | **83 berths** (higher density) |\n"
                    "| **Fare** | Standard base fare | **~6% to 8% Cheaper** than 3A |\n"
                    "| **Headroom & Space** | Standard spacing | Slightly more compact middle/upper berth spacing |\n"
                    "| **Amenities** | Shared charging sockets | Individual reading lights & individual USB sockets |\n"
                    "| **AC Vents** | Overhead aisle diffusers | Personalized directional air vents at every berth |\n"
                    "| **Linen & Bedroll** | ✅ Included | ✅ Included |"
                ),
                "steps": [],
                "routes": [],
                "suggestions": [
                    "Trains from Delhi to Jodhpur tomorrow in 3A",
                    "What is RAC ticket?",
                    "What are Tatkal booking timings?"
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

        # 4. Web Search & Railway Intel (Rules, Cancellation, Tatkal Slabs, Concession, Luggage)
        rail_intel_keywords = [
            "rule", "rules", "cancellation", "cancel", "refund", "tatkal time", "tatkal open",
            "tatkal rule", "luggage", "baggage", "rac", "current booking", "senior citizen concession",
            "food", "pantry", "bulletin", "delay", "vande bharat rule", "infant ticket"
        ]
        from_chk, to_chk = extract_station_pair(text)
        if any(k in lower for k in rail_intel_keywords) and not (from_chk and to_chk and ("train" in lower or "search" in lower)):
            steps.append({
                "label": f"Searching live web intelligence & official railway guidelines for '{text[:40]}'",
                "type": "tool_call",
                "toolName": "web_search_rail_intel",
                "input": {"query": text}
            })
            intel_res = await web_search_rail_intel.ainvoke({"query": text})
            steps.append({
                "label": f"Retrieved official guidelines for {intel_res.get('category')}",
                "type": "tool_result"
            })
            bullet_points = "\n".join([f"• {p}" for p in intel_res.get("key_points", [])])
            snippet_part = f"\n\n> 🌐 **Live Web Intelligence:** {intel_res['web_snippet']}" if intel_res.get("web_snippet") else ""
            reply = (
                f"### 📋 {intel_res.get('category')}\n\n"
                f"{bullet_points}"
                f"{snippet_part}\n\n"
                f"*(Source: {intel_res.get('source')})*"
            )
            return {
                "text": reply,
                "steps": steps,
                "routes": [],
                "suggestions": [
                    "Check chart preparation time for 18:00 departure",
                    "From Delhi to Mumbai tomorrow in 3A confirmed only",
                    "Compare 5 days NDLS to SBC"
                ]
            }

        # 5. Multi-Date Comparison: e.g. "compare next 5 days from NDLS to SBC"
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

        # Multi-city scan if no explicit "from/to"
        if not from_raw or not to_raw:
            found_cities = []
            for city in CITY_TO_DEFAULT_CODE.keys():
                if city.lower() in lower:
                    code = CITY_TO_DEFAULT_CODE[city]
                    if not any(fc[1] == code for fc in found_cities):
                        found_cities.append((city, code))
            if len(found_cities) >= 2:
                from_raw, to_raw = found_cities[0][0], found_cities[1][0]

        # Multi-Turn Context Carryforward:
        # If user asks a follow-up ("what about 3A?", "is there tatkal?", "check next day")
        # and from/to is not repeated, reuse prev_src and prev_dst!
        if (not from_raw or not to_raw) and prev_src and prev_dst:
            has_followup_intent = bool(
                parse_class_from_text(text)
                or parse_budget_from_text(text)
                or parse_date_from_text(text)
                or "tatkal" in lower
                or "confirm" in lower
                or "available" in lower
                or "sleeper" in lower
                or "cheaper" in lower
                or "faster" in lower
            )
            if has_followup_intent:
                from_raw, to_raw = prev_src, prev_dst

        if not from_raw or not to_raw:
            has_rail_search_intent = bool(re.search(r"\b(train|trains|ticket|tickets|seat|seats|berth|travel|go|going|book|booking|journey|route|reach|leave)\b", clean_text))
            if has_rail_search_intent:
                return {
                    "text": (
                        "I would be glad to find the best trains and seats for you! 🚆\n\n"
                        "Could you please specify both your **origin** and **destination**?\n\n"
                        "**For example:**\n"
                        "• *'Trains from Delhi to Jodhpur tomorrow in 3A'*\n"
                        "• *'From Jhansi to Bangalore on 28 Dec under 1500'*"
                    ),
                    "steps": [],
                    "routes": [],
                    "suggestions": [
                        "Trains from Delhi to Jodhpur tomorrow",
                        "From Jhansi to Bangalore on 28 Dec under 1500",
                        "Trains from Lucknow to Bangalore under 1500"
                    ]
                }
            else:
                if any(w in clean_text for w in ["bored", "bore", "timepass", "free"]):
                    reply_text = (
                        "Boredom during travel is an Indian Railways tradition! 😄\n\n"
                        "Want to hear a hilarious train travel joke, learn a smart seat-booking lifehack (like same-train split ticketing), or check out the fastest Vande Bharat routes in India?\n\n"
                        "Or just tell me where you'd like to travel next!"
                    )
                elif any(w in clean_text for w in ["help", "assist", "guide", "confused", "suggest"]):
                    reply_text = (
                        f"I'm here to help you navigate Indian Railways like a pro! 🚆\n\n"
                        "Here is what I can do for you right now:\n"
                        "1. **Find Confirmed Seats:** Discover direct trains, split-seat hacks, and alternate boarding stations.\n"
                        "2. **Quota & Timing Intelligence:** Tatkal opening rules, Premium Tatkal surge dynamics, and ladies quota.\n"
                        "3. **Timetables & Halt Tracking:** Stops, platform numbers, and live train timetables.\n"
                        "4. **IRCTC Rules & Refunds:** Cancellation slabs, RAC rules, and chart preparation timelines.\n\n"
                        "Where would you like to travel, or what railway question do you have?"
                    )
                else:
                    reply_text = (
                        f"👋 {time_greeting}! I'm here and ready to help with your Indian Railways travel. 🚆\n\n"
                        "Whether you want to discover confirmed seats, uncover same-train split hacks, understand Tatkal rules, or check train timetables, just tell me your starting station and destination, or ask any railway question!"
                    )

                return {
                    "text": reply_text,
                    "steps": [],
                    "routes": [],
                    "suggestions": [
                        "Trains from Delhi to Jodhpur tomorrow in 3A",
                        "Jhansi to Bangalore on 28 Dec under 1500",
                        "Tell me a railway joke",
                        "What is RAC ticket?"
                    ]
                }

        date = parse_date_from_text(text) or prev_date or (datetime.now() + timedelta(days=1)).strftime("%d-%m-%Y")
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

"""
LangChain & LangGraph Orchestrator for IRCTC Copilot.
Handles multi-provider GenAI LLMs (Gemini, OpenAI, Ollama Cloud/Local),
manages conversational state, dispatches tools, and gracefully falls back to SmartFallbackAgent.
"""

import asyncio
import json
import logging
import os
from typing import Annotated, Any, AsyncGenerator, Dict, List, Optional, TypedDict

import operator
try:
    from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage
    from langgraph.graph import END, START, StateGraph
except ImportError:
    class BaseMessage:
        def __init__(self, content="", **kwargs):
            self.content = content
    class AIMessage(BaseMessage): pass
    class HumanMessage(BaseMessage): pass
    class SystemMessage(BaseMessage): pass
    class ToolMessage(BaseMessage):
        def __init__(self, content="", tool_call_id="", **kwargs):
            super().__init__(content=content)
            self.tool_call_id = tool_call_id
    END = "END"
    START = "START"
    StateGraph = None

try:
    from app.agent.tools import ALL_AGENT_TOOLS, TOOLS_BY_NAME
    from app.agent.fallback_agent import SmartFallbackAgent
except ImportError:
    from backend.app.agent.tools import ALL_AGENT_TOOLS, TOOLS_BY_NAME
    from backend.app.agent.fallback_agent import SmartFallbackAgent

logger = logging.getLogger("IrctcAgent.Graph")

SYSTEM_PROMPT_TEMPLATE = """You are IRCTC AGENT, the official, highly intelligent, and autonomous Indian Railways AI assistant.
Your name is strictly **IRCTC AGENT**. You are NOT ChatGPT, you are NOT developed by OpenAI, and you do NOT lack internet tools or live data.
You have real-time algorithmic tools for Indian Railways and live seat availability.

Current Date Context:
- Today's Date: {today_str} ({day_name})
- Tomorrow's Date: {tomorrow_str}

Guidelines & Capabilities:
1. Travel Searches: When the user asks to find trains, tickets, or seat availability, ALWAYS invoke the `search_trains` tool. Map cities to station codes (e.g. Delhi -> NDLS, Mumbai -> CSMT, Bangalore -> SBC, Jodhpur -> JU, Jhansi -> VGLJ). Always pass the correct date in DD-MM-YYYY format.
2. Timetables & Schedules: For train stops, timetable, or platform queries, invoke `get_train_schedule`.
3. Charting Status: For questions on chart preparation or vacancy charts, invoke `get_charting_status`.
4. Rules & Intel: For cancellation charges, refund rules, RAC rules, Tatkal timings, senior citizen concessions, or luggage allowances, explain accurately or use `web_search_rail_intel`.
5. Conversational & Wit:
   - For casual greetings, jokes, philosophical queries, or emotional reactions (e.g. 'lol', 'tell me a joke', 'who are you', 'how are you', 'another one'), converse naturally, dynamically, and with cultural wit and humor like an experienced Indian train traveler.
   - NEVER output empty strings or break character.
6. Formatting: Present train options with clean markdown tables and bullet highlights. Always highlight confirmed options, cheapest fares, and any same-train split lifehacks.
"""


def make_compact_tool_payload(fn_name: str, result: Any) -> str:
    """Produces a clean, token-efficient summary for LLMs to stay well within ITPM/rate limits."""
    if not isinstance(result, dict):
        return str(result)[:1500]

    if fn_name == "search_trains":
        routes = result.get("routes", [])
        top_opts = []
        for r in routes[:5]:
            legs = r.get("legs", [])
            leg0 = legs[0] if legs else {}
            leg_last = legs[-1] if legs else {}
            top_opts.append({
                "train_name": leg0.get("train_name"),
                "train_no": leg0.get("train_no"),
                "departure": leg0.get("departure"),
                "arrival": leg_last.get("arrival"),
                "total_duration": r.get("total_duration_str"),
                "fare": r.get("best_fare"),
                "confidence": r.get("booking_confidence"),
                "status_summary": r.get("summary"),
                "split_hack": r.get("lifehack_type")
            })

        compact = {
            "origin": result.get("origin"),
            "destination": result.get("destination"),
            "date": result.get("date"),
            "total_options_found": len(routes),
            "confirmed_count": result.get("confirmed_count", 0),
            "lowest_fare": result.get("lowest_fare", 0),
            "top_recommendations": top_opts
        }
        return json.dumps(compact, indent=2)

    elif fn_name == "get_train_schedule":
        stops = result.get("stops", [])
        return json.dumps({
            "train_no": result.get("train_no"),
            "train_name": result.get("train_name"),
            "source": result.get("source"),
            "destination": result.get("destination"),
            "total_duration": result.get("total_duration"),
            "total_stops": len(stops),
            "stops_preview": stops[:8]
        }, indent=2)

    return json.dumps(result)[:1500]


class AgentState(TypedDict):
    messages: Annotated[List[BaseMessage], operator.add]
    user_config: Dict[str, Any]
    steps: Annotated[List[Dict[str, Any]], operator.add]
    routes: List[Dict[str, Any]]
    suggestions: List[str]


DEFAULT_PROVIDER = os.getenv("DEFAULT_PROVIDER", "groq")
DEFAULT_GROQ_MODEL = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")
DEFAULT_OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen/qwen3.8-27b")
DEFAULT_OLLAMA_ENDPOINT = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")


def get_chat_model(user_config: Dict[str, Any]):
    """Instantiates the requested LLM provider or returns None for fallback."""
    provider = (user_config.get("provider") or DEFAULT_PROVIDER).strip().lower()
    api_key = user_config.get("apiKey") or ""
    model_name = user_config.get("model") or ""
    endpoint = user_config.get("endpoint") or ""

    # Check environment variable fallbacks if user didn't enter key
    if not api_key:
        if provider in ["groq", "default", "auto"]:
            api_key = os.getenv("GROQ_API_KEY", "")
        elif provider == "ollama":
            api_key = os.getenv("OLLAMA_API_KEY", "")
        elif provider == "gemini":
            api_key = os.getenv("GEMINI_API_KEY", "")
        elif provider == "openai":
            api_key = os.getenv("OPENAI_API_KEY", "")
        elif provider == "openrouter":
            api_key = os.getenv("OPENROUTER_API_KEY", "")

    # 1. Groq Cloud (Primary Cloud Provider)
    groq_key = api_key if provider == "groq" else os.getenv("GROQ_API_KEY", "")
    if provider in ["groq", "default", "auto"] or groq_key:
        if groq_key:
            try:
                from langchain_openai import ChatOpenAI
                chosen_model = model_name or os.getenv("GROQ_MODEL", DEFAULT_GROQ_MODEL)
                if chosen_model in ["qwen3.8", "qwen", "qwen-27b", "qwen3.8-27b"]:
                    chosen_model = "qwen/qwen3.8-27b"
                return ChatOpenAI(
                    base_url="https://api.groq.com/openai/v1",
                    api_key=groq_key,
                    model=chosen_model,
                    temperature=0.6,
                    timeout=25.0
                )
            except Exception as e:
                logger.warning(f"Failed to initialize Groq model: {e}")

    # 2. OpenRouter (Multi-model free/paid gateway)
    openrouter_key = api_key if provider == "openrouter" else os.getenv("OPENROUTER_API_KEY", "")
    if provider == "openrouter" or (provider in ["auto", "default"] and openrouter_key):
        if openrouter_key:
            try:
                from langchain_openai import ChatOpenAI
                return ChatOpenAI(
                    base_url="https://openrouter.ai/api/v1",
                    api_key=openrouter_key,
                    model=model_name or "meta-llama/llama-3.1-8b-instruct:free",
                    temperature=0.3,
                    timeout=20.0
                )
            except Exception as e:
                logger.warning(f"Failed to initialize OpenRouter model: {e}")

    # 3. Google Gemini
    if provider == "gemini":
        if not api_key:
            logger.info("No Gemini API key provided, using SmartFallbackAgent")
            return None
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            m = model_name or "gemini-2.5-flash"
            return ChatGoogleGenerativeAI(
                model=m,
                google_api_key=api_key,
                temperature=0.2,
                timeout=30
            )
        except Exception as e:
            logger.warning(f"Failed to initialize Gemini model: {e}")
            return None

    # 4. Standard OpenAI / Custom OpenAI base URL
    elif provider in ["openai", "custom"]:
        openai_base = endpoint or os.getenv("OPENAI_BASE_URL", "")
        if not api_key and not openai_base:
            logger.info("No OpenAI API key provided, using SmartFallbackAgent")
            return None
        try:
            from langchain_openai import ChatOpenAI
            m = model_name or "gpt-4o-mini"
            kwargs = {
                "model": m,
                "api_key": api_key or os.getenv("OPENAI_API_KEY", "none"),
                "temperature": 0.2,
                "timeout": 30
            }
            if openai_base:
                kwargs["base_url"] = openai_base
            return ChatOpenAI(**kwargs)
        except Exception as e:
            logger.warning(f"Failed to initialize OpenAI model: {e}")
            return None

    # 5. Ollama
    elif provider == "ollama":
        base_url = endpoint or os.getenv("OLLAMA_BASE_URL", DEFAULT_OLLAMA_ENDPOINT)
        # Fast-fail if running in cloud container and pointing to local host without daemon
        is_cloud = bool(
            os.getenv("X_ZOHO_CATALYST_LISTEN_PORT")
            or os.getenv("CATALYST_ENV")
            or os.getenv("VERCEL")
            or os.getenv("RENDER")
        )
        is_localhost = "localhost" in base_url or "127.0.0.1" in base_url
        if is_cloud and is_localhost:
            logger.info("Cloud deployment detected with local Ollama URL; fast-routing to SmartFallbackAgent")
            return None

        # Fast socket probe if localhost to avoid 45s TCP connect timeout
        if is_localhost:
            import socket
            from urllib.parse import urlparse
            try:
                parsed = urlparse(base_url)
                probe_host = parsed.hostname or "127.0.0.1"
                probe_port = parsed.port or 11434
                with socket.create_connection((probe_host, probe_port), timeout=0.15):
                    pass
            except Exception:
                logger.info(f"Ollama daemon not reachable at {base_url}; fast-routing to SmartFallbackAgent")
                return None

        try:
            from langchain_openai import ChatOpenAI
            m = model_name or os.getenv("OLLAMA_MODEL", DEFAULT_OLLAMA_MODEL)
            key = api_key or os.getenv("OLLAMA_API_KEY", "ollama")
            return ChatOpenAI(
                base_url=base_url,
                api_key=key,
                model=m,
                temperature=0.2,
                timeout=4.0
            )
        except Exception as e:
            logger.warning(f"Failed to initialize Ollama model: {e}")
            return None

    # Default / Auto: if no key was explicitly specified, return None to trigger fast SmartFallbackAgent
    return None


class IrctcAgentOrchestrator:
    """Manages chat conversations and dispatches either LangGraph LLM or SmartFallbackAgent."""

    def __init__(self):
        self.fallback = SmartFallbackAgent()

    async def stream_chat(
        self,
        messages_history: List[Dict[str, str]],
        user_config: Optional[Dict[str, Any]] = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Processes conversation history and yields streaming events:
        - `step`: thought or tool execution updates
        - `delta`: streaming text token
        - `complete`: final aggregated message with interactive cards
        """
        user_config = user_config or {}
        model = get_chat_model(user_config)

        # Extract latest user query
        latest_user_text = ""
        for m in reversed(messages_history):
            if m.get("role") == "user":
                latest_user_text = m.get("content", "")
                break

        if not latest_user_text:
            yield {
                "type": "complete",
                "text": "Hello! How can I assist you with your train journey today?",
                "steps": [],
                "routes": [],
                "suggestions": ["Find trains from Delhi to Mumbai tomorrow"]
            }
            return

        # If no external LLM model configured, run SmartFallbackAgent directly
        if model is None:
            res = await self.fallback.execute_query(latest_user_text, messages_history=messages_history)

            # Only yield steps if actual tools were invoked
            for step in res.get("steps", []):
                yield {"type": "step", "step": step}

            # Simulate streaming tokens cleanly for fluid UX
            text = res.get("text", "")
            chunk_size = 25
            for i in range(0, len(text), chunk_size):
                yield {"type": "delta", "content": text[i:i + chunk_size]}
                await asyncio.sleep(0.008)

            yield {
                "type": "complete",
                "text": text,
                "steps": res.get("steps", []),
                "routes": res.get("routes", []),
                "suggestions": res.get("suggestions", [])
            }
            return

        # LLM LangGraph execution
        try:
            yield {
                "type": "step",
                "step": {
                    "label": f"Connected to {user_config.get('provider', 'AI').title()} Model",
                    "type": "thinking"
                }
            }

            model_with_tools = model.bind_tools(ALL_AGENT_TOOLS)

            # Build message history for LangChain with dynamic date context
            from datetime import datetime, timedelta
            today_str = datetime.now().strftime("%d-%m-%Y")
            day_name = datetime.now().strftime("%A, %d %B %Y")
            tomorrow_str = (datetime.now() + timedelta(days=1)).strftime("%d-%m-%Y")

            dynamic_system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
                today_str=today_str,
                day_name=day_name,
                tomorrow_str=tomorrow_str
            )

            lc_messages: List[BaseMessage] = [SystemMessage(content=dynamic_system_prompt)]
            for m in messages_history[-8:]:
                role = m.get("role")
                content = m.get("content", "")
                if role == "user":
                    lc_messages.append(HumanMessage(content=content))
                elif role == "assistant":
                    lc_messages.append(AIMessage(content=content))

            captured_routes: List[Dict[str, Any]] = []
            all_steps: List[Dict[str, Any]] = []

            # First LLM call
            response = await model_with_tools.ainvoke(lc_messages)

            # Check if LLM requested tool calls
            tool_calls = getattr(response, "tool_calls", []) or []
            tool_iterations = 0

            while tool_calls and tool_iterations < 2:
                tool_iterations += 1
                lc_messages.append(response)

                for tc in tool_calls:
                    fn_name = tc.get("name")
                    fn_args = tc.get("args") or {}
                    call_id = tc.get("id") or fn_name

                    step_item = {
                        "label": f"Executing {fn_name}",
                        "type": "tool_call",
                        "toolName": fn_name,
                        "input": fn_args
                    }
                    all_steps.append(step_item)
                    yield {"type": "step", "step": step_item}

                    tool_fn = TOOLS_BY_NAME.get(fn_name)
                    if tool_fn:
                        try:
                            t_res = await tool_fn.ainvoke(fn_args)
                        except Exception as e:
                            t_res = {"error": str(e)}
                    else:
                        t_res = {"error": f"Tool '{fn_name}' not found."}

                    # Capture route itineraries if search_trains was called
                    if fn_name == "search_trains" and isinstance(t_res, dict):
                        routes_found = t_res.get("routes") or []
                        if routes_found:
                            captured_routes.extend(routes_found)

                    step_finish = {
                        "label": f"Finished {fn_name}",
                        "type": "tool_result",
                        "toolName": fn_name
                    }
                    all_steps.append(step_finish)
                    yield {"type": "step", "step": step_finish}

                    # Compact tool payload to protect against token rate limits
                    compact_content = make_compact_tool_payload(fn_name, t_res)
                    tool_msg = ToolMessage(
                        content=compact_content,
                        tool_call_id=call_id
                    )
                    lc_messages.append(tool_msg)

                # Next invocation after all tool calls in round are answered
                response = await model_with_tools.ainvoke(lc_messages)
                tool_calls = getattr(response, "tool_calls", []) or []

            final_text = response.content if isinstance(response.content, str) else str(response.content)

            # Stream delta tokens to client
            chunk_size = 40
            for i in range(0, len(final_text), chunk_size):
                yield {"type": "delta", "content": final_text[i:i + chunk_size]}
                await asyncio.sleep(0.01)

            yield {
                "type": "complete",
                "text": final_text,
                "steps": all_steps,
                "routes": captured_routes,
                "suggestions": [
                    "Show cheapest options",
                    "Check next day availability",
                    "Are there Tatkal tickets?"
                ]
            }

        except Exception as e:
            logger.warning(f"LLM execution failed ({e}), routing smoothly to SmartFallbackAgent")
            fb_res = await self.fallback.execute_query(latest_user_text, messages_history=messages_history)
            for step in fb_res.get("steps", []):
                yield {"type": "step", "step": step}
            text = fb_res.get("text", "")
            chunk_size = 25
            for i in range(0, len(text), chunk_size):
                yield {"type": "delta", "content": text[i:i + chunk_size]}
                await asyncio.sleep(0.008)
            yield {
                "type": "complete",
                "text": text,
                "steps": fb_res.get("steps", []),
                "routes": fb_res.get("routes", []),
                "suggestions": fb_res.get("suggestions", [])
            }

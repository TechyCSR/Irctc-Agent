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
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage
from langgraph.graph import END, START, StateGraph

try:
    from app.agent.tools import ALL_AGENT_TOOLS, TOOLS_BY_NAME
    from app.agent.fallback_agent import SmartFallbackAgent
except ImportError:
    from backend.app.agent.tools import ALL_AGENT_TOOLS, TOOLS_BY_NAME
    from backend.app.agent.fallback_agent import SmartFallbackAgent

logger = logging.getLogger("IrctcAgent.Graph")

SYSTEM_PROMPT = """You are Antigravity IRCTC Copilot, an elite AI assistant specializing in Indian Railways (IRCTC).
Your job is to help travelers find confirmed tickets, uncover same-train split seats, check tatkal quotas, track live train schedules, and optimize travel fares.

Capabilities & Tools:
1. `search_trains`: Search direct trains, transfer corridors, same-train split seats, and origin hacks.
2. `resolve_station`: Search station codes (e.g. Jhansi -> VGLJ, Bangalore -> SBC/YPR/SMVB, Delhi -> NDLS).
3. `get_train_schedule`: Look up full timetable, halts, arrival/departure times, and platform numbers.
4. `get_multi_date_availability`: Compare seat availability across 5 consecutive travel dates.
5. `get_fare_breakdown`: Calculate IRCTC fare breakup (base fare, superfast, GST).
6. `get_charting_status`: Check 1st and 2nd chart preparation timeline and vacancy booking window.
7. `web_search_rail_intel`: Search live web railway news, official IRCTC circulars, Tatkal rules, cancellation fee slabs, and travel guidelines.

Guidelines:
- If origin or destination station is unclear or given as a general city name, you may use `resolve_station` or directly pass the city name to `search_trains`.
- When users ask to find trains, call `search_trains`.
- If budget or class is mentioned (e.g. 'under 1500', 'sleeper', '3A'), pass them as parameters.
- Provide friendly, concise, and structured answers using markdown bullet points and bold highlights.
- Highlight confirmed options, lowest fares, and any same-train split lifehacks found.
- Be generous and proactive in suggesting follow-up tips or alternate dates if seats are waitlisted.
"""


class AgentState(TypedDict):
    messages: Annotated[List[BaseMessage], operator.add]
    user_config: Dict[str, Any]
    steps: Annotated[List[Dict[str, Any]], operator.add]
    routes: List[Dict[str, Any]]
    suggestions: List[str]


DEFAULT_OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma4:31b")
DEFAULT_OLLAMA_ENDPOINT = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")


def get_chat_model(user_config: Dict[str, Any]):
    """Instantiates the requested LLM provider or returns None for fallback."""
    provider = (user_config.get("provider") or "ollama").strip().lower()
    api_key = user_config.get("apiKey") or ""
    model_name = user_config.get("model") or ""
    endpoint = user_config.get("endpoint") or ""

    # Check environment variable fallbacks if user didn't enter key
    if not api_key:
        if provider == "gemini":
            api_key = os.getenv("GEMINI_API_KEY", "")
        elif provider == "openai":
            api_key = os.getenv("OPENAI_API_KEY", "")
        elif provider == "ollama":
            api_key = os.getenv("OLLAMA_API_KEY", "")

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

    elif provider == "openai":
        if not api_key:
            logger.info("No OpenAI API key provided, using SmartFallbackAgent")
            return None
        try:
            from langchain_openai import ChatOpenAI
            m = model_name or "gpt-4o-mini"
            return ChatOpenAI(
                model=m,
                api_key=api_key,
                temperature=0.2,
                timeout=30
            )
        except Exception as e:
            logger.warning(f"Failed to initialize OpenAI model: {e}")
            return None

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
            res = await self.fallback.execute_query(latest_user_text)

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

            # Build message history for LangChain
            lc_messages: List[BaseMessage] = [SystemMessage(content=SYSTEM_PROMPT)]
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

            while tool_calls:
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

                    tool_msg = ToolMessage(
                        content=json.dumps(t_res) if not isinstance(t_res, str) else t_res,
                        tool_call_id=call_id
                    )
                    lc_messages.append(tool_msg)

                # Next invocation after tools
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
            fb_res = await self.fallback.execute_query(latest_user_text)
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

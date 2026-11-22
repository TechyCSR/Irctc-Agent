"""
IRCTC Agentic AI package.
Includes LangChain/LangGraph tools, graph runner, fallback agent, and MCP server.
"""

try:
    from app.agent.tools import ALL_AGENT_TOOLS, get_mcp_tools_manifest
    from app.agent.graph import IrctcAgentOrchestrator
    from app.agent.fallback_agent import SmartFallbackAgent
    from app.agent.mcp_server import execute_mcp_tool
except ImportError:
    from backend.app.agent.tools import ALL_AGENT_TOOLS, get_mcp_tools_manifest
    from backend.app.agent.graph import IrctcAgentOrchestrator
    from backend.app.agent.fallback_agent import SmartFallbackAgent
    from backend.app.agent.mcp_server import execute_mcp_tool

__all__ = [
    "ALL_AGENT_TOOLS",
    "get_mcp_tools_manifest",
    "IrctcAgentOrchestrator",
    "SmartFallbackAgent",
    "execute_mcp_tool"
]

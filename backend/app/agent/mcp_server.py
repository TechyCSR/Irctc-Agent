"""
Model Context Protocol (MCP) Server for IRCTC Agent.
Implements the Model Context Protocol standard over JSON-RPC (STDIO)
and provides HTTP REST tool endpoints for external agents.
"""

import asyncio
import json
import logging
import sys
from typing import Any, Dict, List, Optional

try:
    from app.agent.tools import ALL_AGENT_TOOLS, TOOLS_BY_NAME, get_mcp_tools_manifest
except ImportError:
    from backend.app.agent.tools import ALL_AGENT_TOOLS, TOOLS_BY_NAME, get_mcp_tools_manifest

logger = logging.getLogger("IrctcAgent.MCP")


async def execute_mcp_tool(name: str, arguments: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Executes a registered tool by name with arguments."""
    arguments = arguments or {}
    tool = TOOLS_BY_NAME.get(name)
    if not tool:
        return {"isError": True, "content": [{"type": "text", "text": f"Tool '{name}' not found."}]}

    try:
        res = await tool.ainvoke(arguments)
        text_content = json.dumps(res, indent=2) if not isinstance(res, str) else res
        return {
            "isError": False,
            "content": [{"type": "text", "text": text_content}],
            "raw": res
        }
    except Exception as e:
        logger.exception(f"MCP tool execution failed for {name}")
        return {
            "isError": True,
            "content": [{"type": "text", "text": f"Execution error: {str(e)}"}],
            "error": str(e)
        }


async def stdio_server_loop():
    """Reads JSON-RPC MCP requests from stdin and writes responses to stdout."""
    reader = asyncio.StreamReader()
    protocol = asyncio.StreamReaderProtocol(reader)
    await asyncio.get_event_loop().connect_read_pipe(lambda: protocol, sys.stdin)

    while True:
        line = await reader.readline()
        if not line:
            break
        try:
            req = json.loads(line.decode("utf-8").strip())
            req_id = req.get("id")
            method = req.get("method")
            params = req.get("params", {})

            if method == "tools/list":
                resp = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {"tools": get_mcp_tools_manifest()}
                }
            elif method == "tools/call":
                t_name = params.get("name")
                t_args = params.get("arguments", {})
                result = await execute_mcp_tool(t_name, t_args)
                resp = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": result
                }
            else:
                resp = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "error": {"code": -32601, "message": f"Method {method} not supported"}
                }

            sys.stdout.write(json.dumps(resp) + "\n")
            sys.stdout.flush()
        except Exception as e:
            err_resp = {
                "jsonrpc": "2.0",
                "id": None,
                "error": {"code": -32700, "message": f"Parse error: {str(e)}"}
            }
            sys.stdout.write(json.dumps(err_resp) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    asyncio.run(stdio_server_loop())

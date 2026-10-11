import os
import sys

# Ensure lib directory and backend directory are first in sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
lib_dir = os.path.join(current_dir, "lib")

if os.path.exists(lib_dir) and lib_dir not in sys.path:
    sys.path.insert(0, lib_dir)
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

import uvicorn
from app.main import app

if __name__ == "__main__":
    port_str = os.getenv("X_ZOHO_CATALYST_LISTEN_PORT") or os.getenv("PORT") or "8000"
    port = int(port_str)
    print(f"Starting IRCTC AGENT Backend on port {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)

import os
from pathlib import Path

import uvicorn
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from dotenv import load_dotenv

from database.database import engine, Base
from database import models as db_models
from chat import chat
from chat.agent import CURRENT_KEY_INDEX, GEMINI_API_KEYS, LAST_QUOTA_ERROR

# Load environment variables early so that modules like chat.agent
# can see GEMINI_API_KEY, GEMINI_API_KEY_1/2/3, etc.
#
# We support either:
# - a .env file in the project root (one level above datagem_backend), or
# - a .env file in the datagem_backend folder itself.
current_dir = Path(__file__).resolve().parent
project_root_env = current_dir.parent / ".env"
backend_env = current_dir / ".env"

if project_root_env.exists():
    load_dotenv(project_root_env)
elif backend_env.exists():
    load_dotenv(backend_env)

# Create all the database tables
# This command looks at your db_models.py and creates
# the "users" and "chat_history" tables in your database.
db_models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="DataGem AI Analyst Backend",
    description="API for the DataGem project, handling user auth, chat, and AI analysis.",
    version="1.0.0"
)

# Custom middleware to handle OPTIONS requests BEFORE FastAPI routing
# Custom middleware to handle OPTIONS requests BEFORE FastAPI routing
# Custom middleware to handle OPTIONS requests BEFORE FastAPI routing
class CORSOptionsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("origin", "")
        
        # THE MAGIC FIX: Allow localhost, local IPs, and ANY Vercel deployment
        is_allowed = (
            origin.endswith(".vercel.app") or  # <--- Approves all Vercel Preview & Prod URLs
            origin.startswith("http://localhost:") or 
            origin.startswith("http://127.0.0.1:") or
            origin.startswith("http://192.168.") or
            origin.startswith("http://10.") or
            origin.startswith("http://172.")
        )

        # Handle OPTIONS preflight requests immediately - before routing
        if request.method == "OPTIONS":
            response = Response()
            if is_allowed:
                response.headers["Access-Control-Allow-Origin"] = origin
            else:
                # Fallback just in case
                response.headers["Access-Control-Allow-Origin"] = "https://datagemakshit.vercel.app"
            
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, Accept, Origin, X-Requested-With"
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Max-Age"] = "3600"
            return response
        
        # For all other requests, process normally and add CORS headers
        response = await call_next(request)
        if is_allowed:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            # Ensure streaming responses have proper headers
            response.headers["Cache-Control"] = "no-cache"
            response.headers["X-Accel-Buffering"] = "no"
        return response
        
        # For all other requests, process normally and add CORS headers
        response = await call_next(request)
        if is_allowed:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            # Ensure streaming responses have proper headers
            response.headers["Cache-Control"] = "no-cache"
            response.headers["X-Accel-Buffering"] = "no"
        return response
        
        # For all other requests, process normally and add CORS headers
        response = await call_next(request)
        origin = request.headers.get("origin", "")
        # Allow all localhost ports and local network IPs for development
        if (origin.startswith("http://localhost:") or 
            origin.startswith("http://127.0.0.1:") or
            origin.startswith("http://192.168.") or
            origin.startswith("http://10.") or
            origin.startswith("http://172.")):
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            # Ensure streaming responses have proper headers
            response.headers["Cache-Control"] = "no-cache"
            response.headers["X-Accel-Buffering"] = "no"
        return response

# Add our custom middleware - this MUST be added LAST so it runs FIRST
# (Middleware runs in reverse order - last added = first executed)
app.add_middleware(CORSOptionsMiddleware)

# "Plug in" the routers from your other folders
app.include_router(chat.router, prefix="/chat", tags=["Chat"])

@app.get("/", tags=["Root"])
def read_root():
    return {"message": "Welcome to the DataGem AI Backend! Visit /docs for API details."}


@app.get("/health", tags=["Health"])
def health_check():
    """
    Lightweight health endpoint for frontend status checks.
    Returns:
    - active_key_index: 1-based index of the currently active Gemini key
    - total_keys: how many keys are configured
    - last_quota_error: last quota / rate-limit error message (if any)
    """
    active_index = CURRENT_KEY_INDEX + 1
    total_keys = len(GEMINI_API_KEYS)
    return {
        "status": "ok",
        "active_key_index": active_index,
        "total_keys": total_keys,
        "last_quota_error": LAST_QUOTA_ERROR,
    }

# Standard entry point for running the app
if __name__ == "__main__":
    import os
    # Get the current directory (where main.py is located)
    current_dir = os.path.dirname(os.path.abspath(__file__))
    venv_path = os.path.join(current_dir, "venv")
    
    # Only watch specific source directories - DO NOT include current_dir
    # because it contains venv which we want to exclude completely
    reload_dirs = [
        os.path.join(current_dir, "chat"),
        os.path.join(current_dir, "database"),
        os.path.join(current_dir, "auth"),
    ]
    
    # Use absolute paths for excludes to be more explicit
    reload_excludes = [
        venv_path,  # Absolute path to venv
        "venv",
        "venv/**",
        "**/venv/**",
        "**/venv/lib/**",
        "**/venv/bin/**",
        "**/site-packages/**",
        "**/__pycache__/**",
        "**/*.pyc",
        "**/*.pyo",
        "**/.git/**",
    ]
    
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        reload_dirs=reload_dirs,  # Only watch source code directories (not venv)
        reload_excludes=reload_excludes,
        reload_includes=["*.py"]  # Only watch Python files
    )

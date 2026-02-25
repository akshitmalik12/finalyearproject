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
from auth.router import router as auth_router  # 1. Import the auth router
from chat.agent import CURRENT_KEY_INDEX, GEMINI_API_KEYS, LAST_QUOTA_ERROR

# Load environment variables early
current_dir = Path(__file__).resolve().parent
project_root_env = current_dir.parent / ".env"
backend_env = current_dir / ".env"

if project_root_env.exists():
    load_dotenv(project_root_env)
elif backend_env.exists():
    load_dotenv(backend_env)

# Create all the database tables
db_models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="DataGem AI Analyst Backend",
    description="API for the DataGem project, handling user auth, chat, and AI analysis.",
    version="1.0.0"
)

# Custom middleware to handle OPTIONS requests BEFORE FastAPI routing
class CORSOptionsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("origin", "")
        
        # THE MAGIC FIX: Allow localhost, local IPs, and ANY Vercel deployment
        is_allowed = (
            origin.endswith(".vercel.app") or 
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
                # Fallback to your main domain just in case
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

# Add our custom middleware - this MUST be added LAST so it runs FIRST
app.add_middleware(CORSOptionsMiddleware)

# "Plug in" the routers
app.include_router(auth_router)  # 2. Register the auth router (handles /auth/signup and /auth/login)
app.include_router(chat.router, prefix="/chat", tags=["Chat"])

@app.get("/", tags=["Root"])
def read_root():
    return {"message": "Welcome to the DataGem AI Backend! Visit /docs for API details."}

@app.get("/health", tags=["Health"])
def health_check():
    """
    Lightweight health endpoint for frontend status checks.
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
    current_dir = os.path.dirname(os.path.abspath(__file__))
    venv_path = os.path.join(current_dir, "venv")
    
    reload_dirs = [
        os.path.join(current_dir, "chat"),
        os.path.join(current_dir, "database"),
        os.path.join(current_dir, "auth"),
    ]
    
    reload_excludes = [
        venv_path,
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
        reload_dirs=reload_dirs,
        reload_excludes=reload_excludes,
        reload_includes=["*.py"]
    )
# Trigger CI/CD
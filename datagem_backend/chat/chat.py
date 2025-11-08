from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
import traceback

# Internal imports
from database import database, crud, models as db_models
from chat.agent import DataAnalystAgent
import bcrypt

router = APIRouter()


# =====================
# Request Schema
# =====================
class ChatRequest(BaseModel):
    message: str
    dataset: list[dict] | None = None  # Optional dataset data


# =====================
# Endpoint: /chat (router is included with prefix="/chat" in main.py)
# =====================
@router.post("/")
async def chat_endpoint(request: ChatRequest, db: Session = Depends(database.get_db)):
    """
    Handles a user message, streams Gemini’s AI response, and returns it to the frontend.
    """
    try:
        # Use a single anonymous user for all chat sessions (no auth required)
        user_email = "anonymous@datagem.ai"
        user = crud.get_user_by_email(db, user_email)

        if not user:
            # Create anonymous user with bcrypt directly
            password_bytes = "anonymous".encode('utf-8')
            hashed = bcrypt.hashpw(password_bytes, bcrypt.gensalt())
            hashed_password = hashed.decode('utf-8')
            
            new_user = db_models.User(
                email=user_email,
                hashed_password=hashed_password,
                full_name="Anonymous User"
            )
            user = crud.create_user(db=db, user=new_user)

        # ✅ Initialize AI agent
        if request.dataset:
            print(f"📊 Dataset received: {len(request.dataset)} rows, columns: {list(request.dataset[0].keys()) if request.dataset else 'N/A'}")
        else:
            print("⚠️ No dataset provided in request")
        
        agent = DataAnalystAgent(db=db, user=user, dataset=request.dataset)

        # ✅ Define async stream generator
        async def event_stream():
            try:
                async for token in agent.stream_response(request.message):
                    yield token
            except Exception as stream_err:
                print("❌ Error while streaming response:")
                traceback.print_exc()
                yield f"\n[Stream Error] {str(stream_err)}"

        # ✅ Return streaming response
        return StreamingResponse(event_stream(), media_type="text/plain")

    except Exception as e:
        print("❌ Error in /chat endpoint:")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Chat endpoint failed: {str(e)}")

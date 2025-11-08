from pydantic import BaseModel

# (We don't use these yet, but they are good for planning)
class ChatRequest(BaseModel):
    prompt: str
    session_id: str

class ChatResponse(BaseModel):
    response: str
    session_id: str
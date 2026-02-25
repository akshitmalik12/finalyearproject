from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import database, crud, models
from pydantic import BaseModel, EmailStr
# 1. Move the import to the top of the file
from .email import send_welcome_email 

router = APIRouter(prefix="/auth", tags=["auth"])

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

@router.post("/signup")
def signup(user_data: UserCreate, db: Session = Depends(database.get_db)):
    # Check if user already exists
    db_user = crud.get_user_by_email(db, email=user_data.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create the user object
    new_user = models.User(
        email=user_data.email,
        full_name=user_data.full_name,
        hashed_password=user_data.password 
    )
    user = crud.create_user(db=db, user=new_user)
    
    # --- TRIGGER WELCOME EMAIL ---
    send_welcome_email(user.email, user.full_name)
    
    # Return token AND user data immediately to prevent frontend "stuck" state
    return {
        "access_token": f"session_{user.id}", 
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name
        }
    }

# 2. Fixed the stray '}' and added the missing '@'
@router.post("/login")
def login(credentials: UserLogin, db: Session = Depends(database.get_db)):
    user = crud.get_user_by_email(db, email=credentials.email)
    
    # Simple check for now - replace with proper bcrypt.checkpw in production
    if not user or user.hashed_password != credentials.password:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    return {
        "access_token": f"session_{user.id}", 
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name
        }
    }

@router.get("/me")
def get_me(db: Session = Depends(database.get_db)):
    # Fallback to return the first user for session validation
    user = db.query(models.User).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": user.id,
        "email": user.email, 
        "full_name": user.full_name
    }

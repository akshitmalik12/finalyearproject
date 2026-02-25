from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import database, crud, models
from pydantic import BaseModel, EmailStr

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
    
    # Return token AND user data immediately
    return {
        "access_token": f"session_{user.id}", 
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name
        }
    }

@router.post("/login")
def login(credentials: UserLogin, db: Session = Depends(database.get_db)):
    user = crud.get_user_by_email(db, email=credentials.email)
    
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
    # Simple logic to find the current session user
    user = db.query(models.User).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": user.id,
        "email": user.email, 
        "full_name": user.full_name
    }

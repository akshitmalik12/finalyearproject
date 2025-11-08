import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# =====================
# HARDCODED DATABASE URL (INSECURE)
# =====================
# This is the "address" for the PostgreSQL database you started with Docker.
SQLALCHEMY_DATABASE_URL = "postgresql://datagem_user:datagem_pass@localhost:5432/datagem_db"
# =====================

# 1. Create the main "engine" (the power plug)
# We check if the URL was set, just in case.
if not SQLALCHEMY_DATABASE_URL:
    print("Error: DATABASE_URL is not set directly in database/database.py")
    raise ValueError("DATABASE_URL is not set")

engine = create_engine(SQLALCHEMY_DATABASE_URL)

# 2. Create a "factory" that makes new database conversations
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 3. Create a base "blueprint" for all our database tables (models)
Base = declarative_base()

# 4. This is the helper that gives a database conversation to each API request
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

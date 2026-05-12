import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/truckflow")

# Ensure we use psycopg (v3) instead of psycopg2
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

# MAGIC FIX CHO SUPABASE: 
# 1. pool_pre_ping=True: Tự động kiểm tra rớt mạng
# 2. prepare_threshold=None: TẮT prepared statement để không bị lỗi Duplicate với Supabase Pooler
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    connect_args={"prepare_threshold": None} 
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_session():
    session = SessionLocal()
    try:
        return session
    except Exception:
        session.rollback()
        raise

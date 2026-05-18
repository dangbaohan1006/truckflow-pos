import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# 1. Tải các biến môi trường từ file .env (DATABASE_URL, REDIS_URL)
load_dotenv()

# 2. Import Database Engine và Base
from src.core.database import engine, Base

# 3. BẮT BUỘC: Import tất cả các Models vào đây để SQLAlchemy có thể "nhìn thấy" chúng
from src.modules.sales.models import PosOrder, PosOrderLine
from src.modules.inventory.models import InventoryLevel, StockMove, MrpBOM, MrpBOMLine
from src.models.outbox import OutboxEvent

# 4. Lệnh "Thần thánh": Tự động quét và tạo toàn bộ bảng trên Supabase nếu chưa có
Base.metadata.create_all(bind=engine)

# Khởi tạo App
app = FastAPI(title="Food Truck Offline-First POS")

# Cấu hình CORS để PWA có thể gọi API từ Localhost
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import và gắn Router của module Sales
from src.modules.sales.router import router as sales_router
app.include_router(sales_router, prefix="/api/sales", tags=["Sales Sync"])

# Import và gắn Router của module Auth (JWT Authentication)
from src.modules.auth.router import router as auth_router
app.include_router(auth_router)

@app.get("/api/health")
async def health_check():
    return {
        "status": "ok", 
        "database": "Supabase Cloud Connection: Active", 
        "sync_engine": "WatermelonDB Ready",
        "auth": "JWT RS256 with Redis Blacklist"
    }

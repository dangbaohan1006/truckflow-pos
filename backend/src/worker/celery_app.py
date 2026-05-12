import os
from celery import Celery
from dotenv import load_dotenv

# 1. BẮT BUỘC PHẢI GỌI HÀM NÀY ĐỂ ĐỌC FILE .ENV
load_dotenv(override=True)

def _get_env_url(*names: str, default: str) -> str:
    for name in names:
        value = os.getenv(name)
        if value and not value.startswith("redis-cli"):
            return value
    return default


# Lấy Redis URL từ biến môi trường (có fallback cho local dev)
BROKER_URL = _get_env_url("CELERY_BROKER_URL", "REDIS_URL", default="redis://localhost:6379/0")
BACKEND_URL = _get_env_url("CELERY_RESULT_BACKEND", "REDIS_URL", default="redis://localhost:6379/0")

celery_app = Celery(
    "truckflow",
    broker=BROKER_URL,
    backend=BACKEND_URL,
)

# Cấu hình mặc định cho Celery
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Ho_Chi_Minh",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,
    task_soft_time_limit=15 * 60,
)

# Tự động discover tasks từ các module đã đăng ký
celery_app.autodiscover_tasks(["src.modules"])
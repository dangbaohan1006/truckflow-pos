# Sử dụng Python 3.11 slim để tối ưu kích thước image
FROM python:3.11-slim

# Thiết lập biến môi trường
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    # Thiết lập đường dẫn cho Virtual Environment (venv)
    VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:$PATH"

WORKDIR /app

# 1. Cài đặt các thư viện hệ thống cần thiết (C compiler cho psycopg2)
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# 2. Copy binary 'uv' siêu tốc từ image chính thức của Astral
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# 3. Copy các file cấu hình dependency của Poetry
COPY pyproject.toml poetry.lock ./

# 4. Tạo Venv và cài đặt thư viện bằng sự kết hợp giữa uv và poetry
# - Khởi tạo venv bằng uv (cực nhanh)
# - Dùng uv cài poetry (tạm thời)
# - Dùng poetry xuất file lock ra stdout và pipe thẳng vào uv pip để cài đặt đa luồng
# - Gỡ bỏ poetry để làm nhẹ image
RUN uv venv /opt/venv && \
    uv pip install --no-cache poetry && \
    poetry export --without-hashes -f requirements.txt | uv pip install --no-cache -r /dev/stdin && \
    uv pip uninstall poetry

# 5. Copy toàn bộ mã nguồn vào container
COPY . .

# Command khởi chạy FastAPI
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]

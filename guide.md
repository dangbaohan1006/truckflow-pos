# TruckFlow Production Test Guide

Hướng dẫn này dùng cho giai đoạn chạy production test trước khi mua VPS. Mục tiêu là kiểm tra được luồng thật trên subdomain do cPanel quản lý DNS, trong khi frontend chạy trên Vercel và backend chạy trên một host Python tạm thời.

## Mô hình triển khai khuyến nghị

- Frontend React/Vite: deploy lên Vercel, gắn domain/subdomain do cPanel quản lý DNS.
- Backend FastAPI: deploy tạm lên Render.
- PostgreSQL: dùng database managed.
- Redis: dùng Redis managed.
- Celery worker: chạy cùng backend host nếu dịch vụ đó cho phép process nền, hoặc tách riêng nếu cần.

Lý do: backend hiện có FastAPI, JWT, Redis blacklist, và Celery, nên shared hosting cPanel thường không phù hợp để chạy toàn bộ stack. Render dễ dựng web service + worker service hơn trong giai đoạn test.

## Bước 1: Chốt phạm vi test

Chỉ test các luồng đã có thật trong repo:

- Đăng nhập / đăng xuất.
- `/api/health`.
- Đồng bộ WatermelonDB qua `/api/sales/sync`.
- Lưu token và refresh token ở frontend.
- Kết nối online/offline cơ bản.

Chưa cần test sâu các phần còn đang placeholder như báo cáo, finance, in bill, hay tính năng chưa hoàn chỉnh.

## Bước 2: Chuẩn bị frontend build

1. Mở project root `truckflow-pos`.
2. Tạo file env production cho frontend nếu cần.
3. Set `VITE_API_URL` trỏ về URL backend test.
4. Chạy build:

```bash
npm install
npm run build
```

5. Kiểm tra thư mục `dist/` đã được tạo.
6. Deploy frontend lên Vercel và trỏ subdomain về Vercel bằng CNAME/record trong DNS đang quản lý ở cPanel.

File liên quan:

- [src/auth/authApi.ts](src/auth/authApi.ts) - frontend đọc `VITE_API_URL`.
- [src/database/sync.ts](src/database/sync.ts) - sync gọi backend qua `/api/sales/sync`.

## Bước 3: Chuẩn bị backend test

Backend hiện cần các service sau:

- `DATABASE_URL`
- `REDIS_URL`
- `CELERY_BROKER_URL`
- `CELERY_RESULT_BACKEND`
- `JWT_PRIVATE_KEY_PATH`
- `JWT_PUBLIC_KEY_PATH`

File liên quan:

- [backend/src/main.py](backend/src/main.py) - FastAPI app, CORS, health check, create table.
- [backend/src/core/database.py](backend/src/core/database.py) - kết nối PostgreSQL.
- [backend/src/modules/auth/jwt_utils.py](backend/src/modules/auth/jwt_utils.py) - key JWT RSA.
- [backend/docker-compose.yml](backend/docker-compose.yml) - cho thấy đầy đủ service cần thiết.

### Cách triển khai backend test

1. Chọn một host tạm có hỗ trợ Python web app.
2. Deploy source backend lên đó.
3. Cấu hình biến môi trường production.
4. Mount hoặc upload cặp JWT key riêng tư/công khai.
5. Chạy `uvicorn src.main:app --host 0.0.0.0 --port 8000` hoặc lệnh tương đương của platform.
6. Nếu platform hỗ trợ worker nền, chạy Celery worker riêng.

## Bước 4: Tạo cấu hình production cho backend

Tạo file env riêng cho backend test với nội dung tương tự:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME
REDIS_URL=redis://USER:PASSWORD@HOST:6379/0
CELERY_BROKER_URL=redis://USER:PASSWORD@HOST:6379/0
CELERY_RESULT_BACKEND=redis://USER:PASSWORD@HOST:6379/0
JWT_ACCESS_TTL_MINUTES=15
JWT_REFRESH_TTL_DAYS=30
JWT_PRIVATE_KEY_PATH=/app/secrets/jwt_private.pem
JWT_PUBLIC_KEY_PATH=/app/secrets/jwt_public.pem
```

Nếu backend host không cho mount file trực tiếp, hãy dùng secret storage hoặc cơ chế upload file key tương đương của platform.

## Bước 5: Cập nhật frontend để gọi backend thật

1. Set `VITE_API_URL` thành URL backend test.
2. Build lại frontend.
3. Deploy build mới lên Vercel.
4. Mở subdomain để kiểm tra request API đã đi sang backend test chưa.

Lưu ý: ở development, Vite proxy `/api` về localhost, nhưng production không dùng proxy này.

## Bước 6: Kiểm tra backend sau deploy

1. Gọi `GET /api/health`.
2. Xác nhận response trả về `status: ok`.
3. Kiểm tra backend có kết nối được tới database.
4. Kiểm tra Redis hoạt động nếu auth blacklist hoặc Celery cần dùng.
5. Kiểm tra CORS không chặn domain cPanel.

Hiện `allow_origins` trong backend đang mở rộng, nên test xong vẫn nên siết lại domain thật trước go-live. Khi frontend chạy trên Vercel, hãy thêm đúng origin của domain đó vào CORS.

## Bước 7: Test luồng đăng nhập

1. Mở subdomain đã trỏ về Vercel.
2. Đăng nhập bằng tài khoản test.
3. Kiểm tra token được lưu trong localStorage.
4. Đóng/mở lại tab để xác nhận session restore.
5. Gọi profile và logout để xem backend phản hồi đúng.

File liên quan:

- [src/auth/authApi.ts](src/auth/authApi.ts) - lưu token và gửi Authorization header.
- [backend/src/modules/auth/router.py](backend/src/modules/auth/router.py) - login / refresh / logout.

## Bước 8: Test đồng bộ offline-first

1. Tải app lên subdomain.
2. Tạo dữ liệu local hoặc dùng dữ liệu seed sẵn.
3. Tắt mạng.
4. Thao tác bán hàng hoặc thay đổi dữ liệu local.
5. Bật mạng lại.
6. Bấm đồng bộ thủ công hoặc để sync chạy.
7. Xác nhận request `GET /api/sales/sync` và `POST /api/sales/sync` chạy được.

File liên quan:

- [src/database/sync.ts](src/database/sync.ts) - nơi WatermelonDB sync với backend.
- [src/database/index.ts](src/database/index.ts) - schema local.

## Bước 9: Những lỗi cần ưu tiên bắt trước khi mua VPS

1. CORS sai domain.
2. `VITE_API_URL` trỏ nhầm.
3. Backend thiếu env hoặc thiếu JWT key.
4. Database không cho kết nối từ host backend.
5. Redis không dùng được cho blacklist hoặc Celery.
6. Sync lỗi do endpoint backend chưa khớp.
7. Backend đang tự `create_all` bảng, nên kiểm tra kỹ schema trước khi dùng dữ liệu thật.

## Bước 10: Khi nào mới nên mua VPS

Nên mua VPS khi bạn đã test xong các điểm sau:

- Frontend cPanel gọi backend thật ổn.
- Login và refresh token chạy bình thường.
- Sync offline-first không lỗi.
- Database và Redis chạy ổn định trên môi trường test.
- Bạn đã ước lượng được RAM/CPU cần cho backend + worker.

Khi đó bạn chỉ cần chuyển backend, worker, DB proxy, và reverse proxy sang VPS riêng hoặc lên một stack Docker đầy đủ.

## Tóm tắt ngắn

- cPanel: chỉ dùng để quản lý DNS/subdomain.
- Frontend: chạy trên Vercel.
- Backend: chạy tạm trên Render.
- Database và Redis: dùng managed service trong giai đoạn test.
- Chỉ sau khi test ổn mới mua VPS.

## Checklist Vercel + Render

- [ ] Tạo subdomain trong cPanel và trỏ DNS về Vercel.
- [ ] Deploy frontend lên Vercel.
- [ ] Set `VITE_API_URL` trỏ về URL Render của backend.
- [ ] Deploy backend FastAPI lên Render.
- [ ] Tạo Redis managed và PostgreSQL managed.
- [ ] Set đủ env cho backend: `DATABASE_URL`, `REDIS_URL`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`, `JWT_PRIVATE_KEY_PATH`, `JWT_PUBLIC_KEY_PATH`.
- [ ] Nếu dùng Celery, tạo worker service riêng trên Render.
- [ ] Kiểm tra `GET /api/health`.
- [ ] Test đăng nhập, refresh token, logout.
- [ ] Test sync offline-first qua `/api/sales/sync`.
- [ ] Siết lại CORS chỉ cho domain Vercel thật.
- [ ] Sau khi ổn định mới tính mua VPS.

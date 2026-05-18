# Deploy Guide — Vercel (frontend) + Render (backend)

This file contains copy-paste friendly steps to deploy the frontend to Vercel and backend to Render, plus the environment variables and quick CLI commands.

---

## 1) Frontend -> Vercel

Prerequisites: GitHub repo (or connect Vercel to your repo), Vercel account.

1. On your local machine, ensure `VITE_API_URL` will point to the backend URL (Render) during production.

Set env locally or add to Vercel after linking repo.

2. Build locally to verify:

```bash
cd truckflow-pos
npm install
npm run build
ls dist
```

3. Deploy to Vercel (two options):

- Via Vercel Dashboard: connect your GitHub repo, set Build Command `npm run build` and Output Directory `dist`.
- Or via Vercel CLI:

```bash
npm i -g vercel
vercel login
cd truckflow-pos
vercel --prod
```

4. Add the production environment variable in Vercel (Project Settings → Environment Variables):

- `VITE_API_URL` = `https://your-backend.onrender.com` (replace with actual Render service URL)

5. Configure your domain/subdomain in Vercel and/or point DNS (in cPanel) to Vercel's records (CNAME / A records) per Vercel docs.

6. Confirm that loading your domain serves the app and that console network requests go to the `VITE_API_URL`.

---

## 2) Backend -> Render

Prerequisites: Render account, GitHub repo connected to Render (or use `render.yaml`).

1. Create Managed Services (if not existing):

- PostgreSQL (managed) — note the connection string.
- Redis (managed) — note the connection string.

2. On Render dashboard, create a new **Web Service**:

- Connect to your GitHub repo and choose the backend folder (if monorepo, point to `truckflow-pos/backend`).
- Select Docker as environment and specify the Dockerfile path (`backend/Dockerfile`).
- Set the start command: `uvicorn src.main:app --host 0.0.0.0 --port 8000`.

3. Set environment variables (in Render service settings or via `render.yaml` secrets):

- `DATABASE_URL` — e.g. `postgresql://user:pass@host:5432/truckflow`
- `REDIS_URL` — e.g. `redis://:password@host:6379/0`
- `CELERY_BROKER_URL` — same as `REDIS_URL`
- `CELERY_RESULT_BACKEND` — same as `REDIS_URL`
- `JWT_ACCESS_TTL_MINUTES` — `15`
- `JWT_REFRESH_TTL_DAYS` — `30`
- `JWT_PRIVATE_KEY_PATH` — e.g. `/var/run/secrets/jwt_private.pem` (see note)
- `JWT_PUBLIC_KEY_PATH` — e.g. `/var/run/secrets/jwt_public.pem`

4. Upload/mount JWT key pair:

- Render supports private files via Secrets/Files; upload `jwt_private.pem` and `jwt_public.pem` and set their mounted paths.

5. (Optional) Create a **Worker** service on Render for Celery:

- Use the same repo and Dockerfile, but set start command: `celery -A src.worker.celery_app worker --loglevel=info`.
- Attach same environment variables and secrets.

6. Deploy and watch logs in Render dashboard. Verify `/api/health`.

---

## 3) Post-deploy checks

1. Confirm Vercel `VITE_API_URL` points to Render public URL and CORS allows the origin.
2. From browser console, try `GET https://your-backend.onrender.com/api/health`.
3. Test login flow from frontend.
4. Test sync endpoints.

## 4) Quick commands summary

Vercel CLI deploy (inside `truckflow-pos`):

```bash
vercel --prod
```

Render (dashboard recommended) — GitHub link + `render.yaml` provided in repo.

If you prefer CLI for Render (advanced), see Render docs; dashboard flow is simplest for services and secrets.

---

## 5) Common issues & fixes

- CORS errors: add exact Vercel domain to backend `allow_origins`.
- 500 on backend: check environment variables and JWT key mounting.
- Sync failures: inspect request/response body in browser devtools and backend logs.

---

If you want, tôi có thể: (A) create the Render services in your Render account (you must invite me or provide CI tokens), hoặc (B) walk you step-by-step while you click the Render/Vercel dashboard.

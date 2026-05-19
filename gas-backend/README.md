# Google Apps Script Backend for TruckFlow POS

## Architecture

```
Frontend (React + Vite) → Vercel
    ↕ HTTPS JSON
Google Apps Script Web App (backend)
    ↕ Google Sheets API (internal)
Google Sheets (database)
```

## Files

| File | Purpose |
|------|---------|
| `Code.gs` | Main entry point, doGet/doPost routing, CORS handling |
| `Auth.gs` | Google OAuth login, session management |
| `Sync.gs` | WatermelonDB sync protocol (pull/push for all tables) |
| `Sheets.gs` | Google Sheets CRUD operations (repository layer) |
| `Inventory.gs` | Inventory-specific operations (receive, issue, count, adjust) |
| `Sales.gs` | Sales order operations |
| `Reports.gs` | Report generation helpers |
| `Config.gs` | Sheet names, column mappings, constants |

## Google Sheets Structure

Each sheet tab acts as a database table:

| Sheet Tab | Purpose |
|-----------|---------|
| `sessions` | Active user sessions (token, userId, email, createdAt) |
| `users` | User profiles (id, email, name, role, permissions) |
| `inventory_levels` | Current stock levels (product_id, quantity, updated_at) |
| `stock_moves` | Stock movement history (id, product_id, quantity, origin, meta, created_at) |
| `orders` | Sales orders (id, total, status, created_at, updated_at) |
| `order_lines` | Order line items (id, order_id, product_id, quantity, price) |
| `outbox` | Event outbox for sync (aggregate_type, aggregate_id, event_type, payload) |

## Deploy

1. Go to script.google.com
2. Create a new project
3. Copy all `.gs` files into the editor
4. Set up Google OAuth consent screen (Cloud Console)
5. Deploy as Web App (Execute as: "User accessing the web app")
6. Copy the Web App URL → set as `VITE_API_URL` in Vercel

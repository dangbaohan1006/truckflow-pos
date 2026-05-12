import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'truckflow.db');
const db = new Database(dbPath);

// Initialize Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS outbox_events (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    payload TEXT NOT NULL,
    processed INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS inventory_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sku TEXT UNIQUE NOT NULL,
    unit TEXT NOT NULL,
    quantity TEXT NOT NULL, -- DECIMAL(15,4) equivalent
    reorder_level TEXT NOT NULL,
    server_updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS stock_moves (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    quantity TEXT NOT NULL,
    type TEXT NOT NULL,
    reference_id TEXT,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(item_id) REFERENCES inventory_items(id)
  );

  CREATE TABLE IF NOT EXISTS sales_orders (
    id TEXT PRIMARY KEY,
    total_amount TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    server_updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    quantity TEXT NOT NULL,
    price TEXT NOT NULL,
    FOREIGN KEY(order_id) REFERENCES sales_orders(id)
  );
`);

export default db;

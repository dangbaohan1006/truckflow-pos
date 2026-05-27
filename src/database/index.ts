import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';

import { schema } from './schema.js';
import InventoryItem from './models/InventoryItem.js';
import SalesOrder from './models/SalesOrder.js';
import SalesOrderLine from './models/SalesOrderLine.js';
import StockMovement from './models/StockMovement.js';
import BomRecord from './models/BomRecord.js';
import Supplier from './models/Supplier.js';
import Truck from './models/Truck.js';
import Shift from './models/Shift.js';
import Transaction from './models/Transaction.js';
import Employee from './models/Employee.js';
import Attendance from './models/Attendance.js';
import Advance from './models/Advance.js';
import User from './models/User.js';
import MenuItem from './models/MenuItem.js';
import MenuIngredient from './models/MenuIngredient.js';
import migrations from './migrations.js';
export { syncProvider as mySync, publishMenuToBackend } from './sync.js';

const adapter = new LokiJSAdapter({
  schema,
  migrations,
  useWebWorker: false,
  useIncrementalIndexedDB: true,
  onSetUpError: (error) => {
    console.error('WatermelonDB local setup error (likely schema mismatch or missing migration):', error);
    try {
      console.warn('Attempting to delete local database to allow fresh schema recreation...');
      const dbRequest = window.indexedDB.deleteDatabase('watermelon');
      dbRequest.onsuccess = () => {
        console.log('Database deleted successfully. Reloading page...');
        window.location.reload();
      };
      dbRequest.onerror = () => {
        console.warn('Failed to delete indexedDB database, clearing localStorage as fallback...');
        localStorage.clear();
        window.location.reload();
      };
    } catch (e) {
      console.error('Emergency fallback: clearing localStorage and reloading:', e);
      localStorage.clear();
      window.location.reload();
    }
  }
});

export const database = new Database({
  adapter,
  modelClasses: [
    InventoryItem,
    SalesOrder,
    SalesOrderLine,
    StockMovement,
    BomRecord,
    Supplier,
    Truck,
    Shift,
    Transaction,
    Employee,
    Attendance,
    Advance,
    User,
    MenuItem,
    MenuIngredient,
  ],
});

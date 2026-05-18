import { database } from './index.js';
import { generateId } from '../shared/utils.js';

import User from './models/User.js';
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

const SEED_FLAG = 'truckflow_test_data_seeded_v1';

type SeedResult = {
  created: boolean;
  message: string;
};

type SeedOptions = {
  force?: boolean;
};

type InventorySeed = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  quantity: string;
  reorderLevel: string;
  price: string;
  category: string;
  isRawMaterial: boolean;
};

type UserSeed = {
  username: string;
  password: string;
  displayName: string;
  role: string;
  status: string;
};

function daysAgo(days: number, hours = 0): number {
  return Date.now() - (days * 24 * 60 * 60 * 1000) - (hours * 60 * 60 * 1000);
}

async function ensureUserSeed(users: UserSeed[]) {
  const existingUsers = await database.get<User>('users').query().fetch();
  const existingUsernames = new Set(existingUsers.map((user: any) => user.username));
  for (const user of users) {
    if (existingUsernames.has(user.username)) continue;
    await database.get<User>('users').create((record: any) => {
      record._raw.id = generateId();
      record.username = user.username;
      record.password = user.password;
      record.displayName = user.displayName;
      record.role = user.role;
      record.status = user.status;
    });
  }
}

async function createInventoryItems(items: InventorySeed[]) {
  const table = database.get<InventoryItem>('inventory_items');
  for (const item of items) {
    await table.create((record: any) => {
      record._raw.id = item.id;
      record.name = item.name;
      record.sku = item.sku;
      record.unit = item.unit;
      record.quantity = item.quantity;
      record.reorderLevel = item.reorderLevel;
      record.price = item.price;
      record.category = item.category;
      record.isRawMaterial = item.isRawMaterial;
    });
  }
}

async function hasAnyCoreSeedData() {
  const tableNames = [
    'inventory_items',
    'pos_order',
    'pos_order_line',
    'stock_movements',
    'bom_records',
    'suppliers',
    'trucks',
    'shifts',
    'transactions',
    'employees',
    'attendance',
    'advances',
  ];

  for (const tableName of tableNames) {
    const records = await database.get<any>(tableName).query().fetch();
    if (records.length > 0) {
      return true;
    }
  }

  return false;
}

async function clearSeedTables() {
  const tableNames = [
    'pos_order_line',
    'pos_order',
    'stock_movements',
    'bom_records',
    'suppliers',
    'trucks',
    'shifts',
    'transactions',
    'employees',
    'attendance',
    'advances',
    'inventory_items',
  ];

  await database.write(async () => {
    for (const tableName of tableNames) {
      const records = await database.get<any>(tableName).query().fetch();
      for (const record of records) {
        await record.destroyPermanently();
      }
    }
  });

  localStorage.removeItem(SEED_FLAG);
}

export async function seedTestData(options: SeedOptions = {}): Promise<SeedResult> {
  const force = options.force ?? false;

  // Check if seed has already been completed
  const hasSeedFlag = localStorage.getItem(SEED_FLAG);
  if (!force && hasSeedFlag) {
    console.log('✓ Test data already seeded, skipping');
    return { created: false, message: 'Dữ liệu test đã có sẵn, bỏ qua import.' };
  }

  if (force) {
    console.log('🔄 Force reimporting test data...');
    await clearSeedTables();
  }

  try {
    const now = Date.now();

    const trucks = [
      { id: generateId(), name: 'Xe bán hàng 01', code: 'TRUCK-001', status: 'ACTIVE', location: 'Cổng chính chợ đêm' },
      { id: generateId(), name: 'Xe dự phòng 02', code: 'TRUCK-002', status: 'MAINTENANCE', location: 'Kho trung tâm' },
    ];

    const suppliers = [
      { id: generateId(), name: 'Viet Beans Co., Ltd.', phone: '0901112233', address: 'Bình Thạnh, TP.HCM', note: 'Nhà cung cấp hạt cà phê' },
      { id: generateId(), name: 'Fresh Dairy Supply', phone: '0902223344', address: 'Dĩ An, Bình Dương', note: 'Nhà cung cấp sữa và nguyên liệu lạnh' },
    ];

    const employees = [
      { id: generateId(), name: 'Nguyễn Văn An', phone: '0903000001', role: 'Thu ngân', salary: '8000000', status: 'ACTIVE' },
      { id: generateId(), name: 'Trần Thị Bình', phone: '0903000002', role: 'Nhân viên kho', salary: '9000000', status: 'ACTIVE' },
      { id: generateId(), name: 'Lê Minh Quân', phone: '0903000003', role: 'Bếp chính', salary: '9500000', status: 'ACTIVE' },
      { id: generateId(), name: 'Phạm Thu Hà', phone: '0903000004', role: 'Kế toán', salary: '8500000', status: 'ACTIVE' },
    ];

  const inventoryItems: InventorySeed[] = [
    { id: generateId(), name: 'Cà phê sữa đá', sku: 'PRD-COF-001', unit: 'ly', quantity: '80', reorderLevel: '20', price: '25000', category: 'Đồ uống', isRawMaterial: false },
    { id: generateId(), name: 'Bánh mì thịt', sku: 'PRD-BMI-001', unit: 'ổ', quantity: '40', reorderLevel: '15', price: '30000', category: 'Đồ ăn', isRawMaterial: false },
    { id: generateId(), name: 'Trà đào cam sả', sku: 'PRD-TEA-001', unit: 'ly', quantity: '35', reorderLevel: '10', price: '32000', category: 'Đồ uống', isRawMaterial: false },
    { id: generateId(), name: 'Nước ép cam', sku: 'PRD-JUI-001', unit: 'ly', quantity: '25', reorderLevel: '10', price: '28000', category: 'Đồ uống', isRawMaterial: false },
    { id: generateId(), name: 'Cà phê hạt', sku: 'MAT-COF-001', unit: 'kg', quantity: '20', reorderLevel: '5', price: '180000', category: 'Nguyên liệu', isRawMaterial: true },
    { id: generateId(), name: 'Sữa đặc', sku: 'MAT-MIL-001', unit: 'lon', quantity: '60', reorderLevel: '10', price: '22000', category: 'Nguyên liệu', isRawMaterial: true },
    { id: generateId(), name: 'Bánh mì ổ', sku: 'MAT-BRD-001', unit: 'ổ', quantity: '120', reorderLevel: '20', price: '5000', category: 'Nguyên liệu', isRawMaterial: true },
    { id: generateId(), name: 'Thịt nguội', sku: 'MAT-HAM-001', unit: 'kg', quantity: '15', reorderLevel: '5', price: '160000', category: 'Nguyên liệu', isRawMaterial: true },
    { id: generateId(), name: 'Trái đào ngâm', sku: 'MAT-PEA-001', unit: 'hộp', quantity: '18', reorderLevel: '5', price: '65000', category: 'Nguyên liệu', isRawMaterial: true },
    { id: generateId(), name: 'Cam tươi', sku: 'MAT-ORA-001', unit: 'kg', quantity: '35', reorderLevel: '8', price: '30000', category: 'Nguyên liệu', isRawMaterial: true },
    { id: generateId(), name: 'Đá viên', sku: 'MAT-ICE-001', unit: 'kg', quantity: '50', reorderLevel: '10', price: '4000', category: 'Nguyên liệu', isRawMaterial: true },
  ];

  const bomRecords = [
    { id: generateId(), productId: inventoryItems[0].id, productName: inventoryItems[0].name, materialId: inventoryItems[4].id, materialName: inventoryItems[4].name, quantity: '0.05', unit: 'kg' },
    { id: generateId(), productId: inventoryItems[0].id, productName: inventoryItems[0].name, materialId: inventoryItems[5].id, materialName: inventoryItems[5].name, quantity: '0.20', unit: 'lon' },
    { id: generateId(), productId: inventoryItems[0].id, productName: inventoryItems[0].name, materialId: inventoryItems[10].id, materialName: inventoryItems[10].name, quantity: '0.30', unit: 'kg' },
    { id: generateId(), productId: inventoryItems[1].id, productName: inventoryItems[1].name, materialId: inventoryItems[6].id, materialName: inventoryItems[6].name, quantity: '1', unit: 'ổ' },
    { id: generateId(), productId: inventoryItems[1].id, productName: inventoryItems[1].name, materialId: inventoryItems[7].id, materialName: inventoryItems[7].name, quantity: '0.08', unit: 'kg' },
    { id: generateId(), productId: inventoryItems[2].id, productName: inventoryItems[2].name, materialId: inventoryItems[8].id, materialName: inventoryItems[8].name, quantity: '0.10', unit: 'hộp' },
    { id: generateId(), productId: inventoryItems[2].id, productName: inventoryItems[2].name, materialId: inventoryItems[10].id, materialName: inventoryItems[10].name, quantity: '0.20', unit: 'kg' },
    { id: generateId(), productId: inventoryItems[3].id, productName: inventoryItems[3].name, materialId: inventoryItems[9].id, materialName: inventoryItems[9].name, quantity: '0.25', unit: 'kg' },
    { id: generateId(), productId: inventoryItems[3].id, productName: inventoryItems[3].name, materialId: inventoryItems[10].id, materialName: inventoryItems[10].name, quantity: '0.20', unit: 'kg' },
  ];

  const orders = [
    {
      id: generateId(),
      createdAt: now - 2 * 60 * 60 * 1000,
      truckId: trucks[0].code,
      paymentMethod: 'cash',
      discount: '0',
      note: 'Đơn giờ cao điểm',
      items: [
        { productId: inventoryItems[0].id, productName: inventoryItems[0].name, price: 25000, qty: 3 },
        { productId: inventoryItems[1].id, productName: inventoryItems[1].name, price: 30000, qty: 2 },
      ],
    },
    {
      id: generateId(),
      createdAt: daysAgo(1, 1),
      truckId: trucks[0].code,
      paymentMethod: 'qr',
      discount: '5',
      note: 'Khuyến mãi cuối ngày',
      items: [
        { productId: inventoryItems[2].id, productName: inventoryItems[2].name, price: 32000, qty: 2 },
        { productId: inventoryItems[3].id, productName: inventoryItems[3].name, price: 28000, qty: 1 },
      ],
    },
    {
      id: generateId(),
      createdAt: daysAgo(3, 2),
      truckId: trucks[1].code,
      paymentMethod: 'card',
      discount: '10',
      note: 'Đơn test thẻ',
      items: [
        { productId: inventoryItems[0].id, productName: inventoryItems[0].name, price: 25000, qty: 2 },
        { productId: inventoryItems[3].id, productName: inventoryItems[3].name, price: 28000, qty: 2 },
      ],
    },
    {
      id: generateId(),
      createdAt: daysAgo(7, 4),
      truckId: trucks[0].code,
      paymentMethod: 'cash',
      discount: '0',
      note: 'Đơn đầu tuần',
      items: [
        { productId: inventoryItems[1].id, productName: inventoryItems[1].name, price: 30000, qty: 4 },
      ],
    },
  ];

  const transactions = [
    { id: generateId(), type: 'INCOME', category: 'Bán hàng', amount: '145000', note: 'Thu tiền đơn bán hàng', referenceType: 'pos_order', referenceId: orders[0].id, createdAt: orders[0].createdAt, updatedAt: orders[0].createdAt },
    { id: generateId(), type: 'INCOME', category: 'Bán hàng', amount: '108000', note: 'Thu tiền đơn QR', referenceType: 'pos_order', referenceId: orders[1].id, createdAt: orders[1].createdAt, updatedAt: orders[1].createdAt },
    { id: generateId(), type: 'EXPENSE', category: 'Nhập hàng', amount: '420000', note: 'Mua thêm nguyên liệu', referenceType: 'supplier_invoice', referenceId: suppliers[0].id, createdAt: daysAgo(2, 4), updatedAt: daysAgo(2, 4) },
    { id: generateId(), type: 'EXPENSE', category: 'Lương', amount: '1200000', note: 'Lương nhân sự tháng này', referenceType: 'payroll', referenceId: employees[0].id, createdAt: daysAgo(5, 1), updatedAt: daysAgo(5, 1) },
    { id: generateId(), type: 'EXPENSE', category: 'Điện nước', amount: '250000', note: 'Chi phí vận hành', referenceType: 'utility', referenceId: 'UTIL-001', createdAt: daysAgo(10, 2), updatedAt: daysAgo(10, 2) },
    { id: generateId(), type: 'INCOME', category: 'Thu khác', amount: '50000', note: 'Hoàn ứng vật tư', referenceType: 'other', referenceId: 'MISC-001', createdAt: daysAgo(12, 3), updatedAt: daysAgo(12, 3) },
  ];

  const stockMovements = [
    { id: generateId(), itemId: inventoryItems[0].id, itemName: inventoryItems[0].name, quantity: '20', type: 'RECEIVE', referenceId: suppliers[0].id, note: 'Nhập hàng test', createdAt: daysAgo(6, 2), updatedAt: daysAgo(6, 2) },
    { id: generateId(), itemId: inventoryItems[1].id, itemName: inventoryItems[1].name, quantity: '10', type: 'RECEIVE', referenceId: suppliers[1].id, note: 'Nhập hàng test', createdAt: daysAgo(6, 1), updatedAt: daysAgo(6, 1) },
    { id: generateId(), itemId: inventoryItems[0].id, itemName: inventoryItems[0].name, quantity: '-3', type: 'SALE', referenceId: orders[0].id, note: 'Bán hàng - đơn seed', createdAt: orders[0].createdAt, updatedAt: orders[0].createdAt },
    { id: generateId(), itemId: inventoryItems[1].id, itemName: inventoryItems[1].name, quantity: '-2', type: 'SALE', referenceId: orders[0].id, note: 'Bán hàng - đơn seed', createdAt: orders[0].createdAt, updatedAt: orders[0].createdAt },
    { id: generateId(), itemId: inventoryItems[2].id, itemName: inventoryItems[2].name, quantity: '-2', type: 'SALE', referenceId: orders[1].id, note: 'Bán hàng - đơn seed', createdAt: orders[1].createdAt, updatedAt: orders[1].createdAt },
    { id: generateId(), itemId: inventoryItems[3].id, itemName: inventoryItems[3].name, quantity: '-1', type: 'SALE', referenceId: orders[1].id, note: 'Bán hàng - đơn seed', createdAt: orders[1].createdAt, updatedAt: orders[1].createdAt },
    { id: generateId(), itemId: inventoryItems[2].id, itemName: inventoryItems[2].name, quantity: '-2', type: 'SALE', referenceId: orders[2].id, note: 'Bán hàng - đơn seed', createdAt: orders[2].createdAt, updatedAt: orders[2].createdAt },
    { id: generateId(), itemId: inventoryItems[3].id, itemName: inventoryItems[3].name, quantity: '-2', type: 'SALE', referenceId: orders[2].id, note: 'Bán hàng - đơn seed', createdAt: orders[2].createdAt, updatedAt: orders[2].createdAt },
    { id: generateId(), itemId: inventoryItems[1].id, itemName: inventoryItems[1].name, quantity: '-4', type: 'SALE', referenceId: orders[3].id, note: 'Bán hàng - đơn seed', createdAt: orders[3].createdAt, updatedAt: orders[3].createdAt },
    { id: generateId(), itemId: inventoryItems[4].id, itemName: inventoryItems[4].name, quantity: '2', type: 'ADJUSTMENT', referenceId: 'ADJ-001', note: 'Kiểm kê tồn kho', createdAt: daysAgo(8, 3), updatedAt: daysAgo(8, 3) },
    { id: generateId(), itemId: inventoryItems[10].id, itemName: inventoryItems[10].name, quantity: '-3', type: 'SPOILAGE', referenceId: 'SPL-001', note: 'Đá bị hao hụt', createdAt: daysAgo(9, 4), updatedAt: daysAgo(9, 4) },
  ];

  const shifts = [
    {
      id: generateId(),
      truckId: trucks[0].code,
      staffName: employees[0].name,
      openingBalance: '500000',
      closingBalance: '1850000',
      expectedBalance: '1850000',
      difference: '0',
      status: 'CLOSED',
      openedAt: daysAgo(1, 10),
      closedAt: daysAgo(1, 2),
      note: 'Ca tối ưu, không chênh lệch',
      createdAt: daysAgo(1, 10),
      updatedAt: daysAgo(1, 2),
    },
    {
      id: generateId(),
      truckId: trucks[1].code,
      staffName: employees[1].name,
      openingBalance: '300000',
      closingBalance: '0',
      expectedBalance: '0',
      difference: '0',
      status: 'OPEN',
      openedAt: daysAgo(0, 6),
      closedAt: 0,
      note: 'Ca đang mở để test',
      createdAt: daysAgo(0, 6),
      updatedAt: daysAgo(0, 6),
    },
  ];

  const attendances = [
    { id: generateId(), employeeId: employees[0].id, date: now, checkIn: daysAgo(0, 8), checkOut: 0, note: 'Vào ca sáng', createdAt: daysAgo(0, 8), updatedAt: daysAgo(0, 8) },
    { id: generateId(), employeeId: employees[1].id, date: daysAgo(1, 0), checkIn: daysAgo(1, 8), checkOut: daysAgo(1, 1), note: 'Ca hôm qua', createdAt: daysAgo(1, 8), updatedAt: daysAgo(1, 1) },
    { id: generateId(), employeeId: employees[2].id, date: daysAgo(2, 0), checkIn: daysAgo(2, 8), checkOut: daysAgo(2, 16), note: 'Đầy đủ', createdAt: daysAgo(2, 8), updatedAt: daysAgo(2, 16) },
  ];

  const advances = [
    { id: generateId(), employeeId: employees[0].id, employeeName: employees[0].name, amount: '500000', note: 'Tạm ứng xăng xe', date: daysAgo(3, 0), createdAt: daysAgo(3, 0), updatedAt: daysAgo(3, 0) },
    { id: generateId(), employeeId: employees[1].id, employeeName: employees[1].name, amount: '300000', note: 'Tạm ứng mua vật tư', date: daysAgo(5, 0), createdAt: daysAgo(5, 0), updatedAt: daysAgo(5, 0) },
  ];

  const sampleUsers: UserSeed[] = [
    { username: 'admin', password: '123456', displayName: 'Administrator', role: 'SYSTEM_ADMIN', status: 'ACTIVE' },
    { username: 'manager', password: '123456', displayName: 'Quản lý cửa hàng', role: 'STORE_MANAGER', status: 'ACTIVE' },
    { username: 'cashier', password: '123456', displayName: 'Thu ngân', role: 'CASHIER', status: 'ACTIVE' },
    { username: 'warehouse', password: '123456', displayName: 'Kho hàng', role: 'WAREHOUSE', status: 'ACTIVE' },
    { username: 'hr', password: '123456', displayName: 'Nhân sự', role: 'HR', status: 'ACTIVE' },
    { username: 'accountant', password: '123456', displayName: 'Kế toán', role: 'ACCOUNTANT', status: 'ACTIVE' },
    { username: 'viewer', password: '123456', displayName: 'Xem báo cáo', role: 'REPORT_VIEWER', status: 'ACTIVE' },
  ];

  await database.write(async () => {
    await ensureUserSeed(sampleUsers);
    await createInventoryItems(inventoryItems);

    const truckTable = database.get<Truck>('trucks');
    for (const truck of trucks) {
      await truckTable.create((record: any) => {
        record._raw.id = truck.id;
        record.name = truck.name;
        record.code = truck.code;
        record.status = truck.status;
        record.location = truck.location;
      });
    }

    const supplierTable = database.get<Supplier>('suppliers');
    for (const supplier of suppliers) {
      await supplierTable.create((record: any) => {
        record._raw.id = supplier.id;
        record.name = supplier.name;
        record.phone = supplier.phone;
        record.address = supplier.address;
        record.note = supplier.note;
      });
    }

    const employeeTable = database.get<Employee>('employees');
    for (const employee of employees) {
      await employeeTable.create((record: any) => {
        record._raw.id = employee.id;
        record.name = employee.name;
        record.phone = employee.phone;
        record.role = employee.role;
        record.salary = employee.salary;
        record.status = employee.status;
      });
    }

    const bomTable = database.get<BomRecord>('bom_records');
    for (const bom of bomRecords) {
      await bomTable.create((record: any) => {
        record._raw.id = bom.id;
        record.productId = bom.productId;
        record.productName = bom.productName;
        record.materialId = bom.materialId;
        record.materialName = bom.materialName;
        record.quantity = bom.quantity;
        record.unit = bom.unit;
      });
    }

    const orderTable = database.get<SalesOrder>('pos_order');
    const lineTable = database.get<SalesOrderLine>('pos_order_line');
    for (const order of orders) {
      const total = order.items.reduce((sum, item) => sum + (item.price * item.qty), 0);
      const discountAmount = total * (parseFloat(order.discount) / 100);
      const finalTotal = total - discountAmount;
      const cashReceived = order.paymentMethod === 'cash' ? Math.ceil(finalTotal / 1000) * 1000 : finalTotal;
      const changeAmount = order.paymentMethod === 'cash' ? Math.max(0, cashReceived - finalTotal) : 0;

      await orderTable.create((record: any) => {
        record._raw.id = order.id;
        record.totalAmount = finalTotal.toFixed(2);
        record.status = 'COMPLETED';
        record.paymentMethod = order.paymentMethod;
        record.cashReceived = cashReceived.toFixed(2);
        record.changeAmount = changeAmount.toFixed(2);
        record.discount = order.discount;
        record.note = order.note;
        record.truckId = order.truckId;
      });

      for (const item of order.items) {
        await lineTable.create((record: any) => {
          record._raw.id = generateId();
          record.orderId = order.id;
          record.productId = item.productId;
          record.productName = item.productName;
          record.quantity = item.qty.toString();
          record.price = item.price.toFixed(2);
          record.subtotal = (item.price * item.qty).toFixed(2);
        });
      }
    }

    const movementTable = database.get<StockMovement>('stock_movements');
    for (const movement of stockMovements) {
      await movementTable.create((record: any) => {
        record._raw.id = movement.id;
        record.itemId = movement.itemId;
        record.itemName = movement.itemName;
        record.quantity = movement.quantity;
        record.type = movement.type;
        record.referenceId = movement.referenceId;
        record.note = movement.note;
      });
    }

    const transactionTable = database.get<Transaction>('transactions');
    for (const tx of transactions) {
      await transactionTable.create((record: any) => {
        record._raw.id = tx.id;
        record.type = tx.type;
        record.category = tx.category;
        record.amount = tx.amount;
        record.note = tx.note;
        record.referenceType = tx.referenceType;
        record.referenceId = tx.referenceId;
      });
    }

    const shiftTable = database.get<Shift>('shifts');
    for (const shift of shifts) {
      await shiftTable.create((record: any) => {
        record._raw.id = shift.id;
        record.truckId = shift.truckId;
        record.staffName = shift.staffName;
        record.openingBalance = shift.openingBalance;
        record.closingBalance = shift.closingBalance;
        record.expectedBalance = shift.expectedBalance;
        record.difference = shift.difference;
        record.status = shift.status;
        record.openedAt = shift.openedAt;
        record.closedAt = shift.closedAt;
        record.note = shift.note;
      });
    }

    const attendanceTable = database.get<Attendance>('attendance');
    for (const attendance of attendances) {
      await attendanceTable.create((record: any) => {
        record._raw.id = attendance.id;
        record.employeeId = attendance.employeeId;
        record.date = attendance.date;
        record.checkIn = attendance.checkIn;
        record.checkOut = attendance.checkOut;
        record.note = attendance.note;
      });
    }

    const advanceTable = database.get<Advance>('advances');
    for (const advance of advances) {
      await advanceTable.create((record: any) => {
        record._raw.id = advance.id;
        record.employeeId = advance.employeeId;
        record.employeeName = advance.employeeName;
        record.amount = advance.amount;
        record.note = advance.note;
        record.date = advance.date;
      });
    }
  });

  console.log('✅ Test data seeding completed:');
  console.log(`  - Users: ${sampleUsers.length}`);
  console.log(`  - Inventory items: ${inventoryItems.length}`);
  console.log(`  - BOM records: ${bomRecords.length}`);
  console.log(`  - POS orders: ${orders.length}`);
  console.log(`  - Suppliers: ${suppliers.length}`);
  console.log(`  - Trucks: ${trucks.length}`);
  console.log(`  - Employees: ${employees.length}`);
  console.log(`  - Attendances: ${attendances.length}`);
  console.log(`  - Advances: ${advances.length}`);
  console.log(`  - Transactions: ${transactions.length}`);
  console.log(`  - Stock movements: ${stockMovements.length}`);
  console.log(`  - Shifts: ${shifts.length}`);

  localStorage.setItem(SEED_FLAG, '1');

  return {
    created: true,
    message: 'Đã tạo dữ liệu test cho POS, Kho, Báo cáo, Thu chi, Nhân sự và Cài đặt.',
  };
  } catch (error) {
    console.error('❌ Error during seed data creation:', error);
    return {
      created: false,
      message: `Lỗi tạo dữ liệu test: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
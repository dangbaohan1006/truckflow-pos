/**
 * Seed Test Data for Reports, Finance (Thu chi), and HR (Nhân sự)
 * 
 * === FLOW NGHIỆP VỤ 1 NGÀY BÁN HÀNG THỰC TẾ ===
 * 
 * Mô phỏng 3 ngày bán hàng gần nhất (Hôm qua, Hôm kia, 3 ngày trước)
 * với đầy đủ các bước nghiệp vụ:
 * 
 * BUỔI SÁNG (6:00-7:00):
 *   1. Nhập kho nguyên liệu từ nhà cung cấp
 *   2. Xuất nguyên liệu cho xe bán hàng (TRANSFER_OUT kho -> TRANSFER_IN xe)
 *   3. Nhân viên đến chấm công (check-in)
 *   4. Mở ca, nhận tiền đầu ca (tạo shift với openingBalance)
 * 
 * CẢ NGÀY (7:00-22:00):
 *   5. Bán hàng liên tục (nhiều đơn, nhiều phương thức thanh toán)
 *   6. Mỗi đơn bán -> xuất kho thành phẩm (stock movement SALE)
 *   7. Mỗi đơn bán -> ghi nhận thu tiền (transaction INCOME)
 * 
 * CUỐI NGÀY (22:00-23:00):
 *   8. Kết ca - tính tổng doanh thu, đối chiếu tiền mặt
 *   9. Kiểm tra nguyên liệu tồn kho (kiểm kê)
 *   10. Nhân viên chấm công ra về (check-out)
 *   11. Ghi nhận chi phí phát sinh trong ngày
 * 
 * Dữ liệu được tạo cho 3 ngày gần nhất, mỗi ngày ~15-25 đơn bán.
 * 
 * Run via: seedReportsFinanceHRData()
 */

import { database } from './index.js';
import { generateId } from '../shared/utils.js';

import SalesOrder from './models/SalesOrder.js';
import SalesOrderLine from './models/SalesOrderLine.js';
import StockMovement from './models/StockMovement.js';
import Transaction from './models/Transaction.js';
import Employee from './models/Employee.js';
import Attendance from './models/Attendance.js';
import Advance from './models/Advance.js';
import Shift from './models/Shift.js';
import Truck from './models/Truck.js';
import InventoryItem from './models/InventoryItem.js';
import Supplier from './models/Supplier.js';
import MenuItem from './models/MenuItem.js';
import MenuIngredient from './models/MenuIngredient.js';

const SEED_FLAG = 'truckflow_reports_finance_hr_seeded_v2';

type SeedResult = {
  created: boolean;
  message: string;
};

type SeedOptions = {
  force?: boolean;
};

// ===== Helper functions =====

/** Get timestamp for a specific day/hour in the past */
function dayTime(dayOffset: number, hour: number, minute = 0): number {
  const d = new Date();
  d.setDate(d.getDate() - dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatCurrency(amount: number): string {
  return amount.toFixed(2);
}

// ===== Interfaces =====

interface ProductDef {
  id: string;
  name: string;
  price: number;
  category: string;
  unit: string;
}

interface EmployeeDef {
  id: string;
  name: string;
  phone: string;
  role: string;
  salary: number;
  status: string;
}

interface TruckDef {
  id: string;
  name: string;
  code: string;
  status: string;
  location: string;
}

interface RawMaterialDef {
  id: string;
  name: string;
  unit: string;
}

// ===== Main seed function =====

export async function seedReportsFinanceHRData(options: SeedOptions = {}): Promise<SeedResult> {
  const force = options.force ?? false;

  const hasSeedFlag = localStorage.getItem(SEED_FLAG);
  if (!force && hasSeedFlag) {
    console.log('✓ Reports/Finance/HR test data already seeded (v2), skipping');
    return { created: false, message: 'Dữ liệu test Reports/Finance/HR đã có sẵn, bỏ qua.' };
  }

  if (force) {
    console.log('🔄 Force reimporting Reports/Finance/HR test data...');
    const tablesToClear = [
      'pos_order_line', 'pos_order', 'stock_movements',
      'transactions', 'employees', 'attendance', 'advances', 'shifts',
    ];
    await database.write(async () => {
      for (const tableName of tablesToClear) {
        const records = await database.get<any>(tableName).query().fetch();
        for (const record of records) {
          await record.destroyPermanently();
        }
      }
    });
    localStorage.removeItem(SEED_FLAG);
  }

  try {
    // ====================================================================
    // PHASE 1: LẤY HOẶC TẠO DỮ LIỆU NỀN (trucks, inventory, suppliers)
    // ====================================================================

    // --- Trucks ---
    let trucks = await database.get<Truck>('trucks').query().fetch();
    if (trucks.length === 0) {
      const truckDefs: TruckDef[] = [
        { id: generateId(), name: 'Xe bán hàng 01 - Chợ đêm', code: 'TRUCK-001', status: 'ACTIVE', location: 'Cổng chính chợ đêm' },
        { id: generateId(), name: 'Xe bán hàng 02 - Công viên', code: 'TRUCK-002', status: 'ACTIVE', location: 'Công viên trung tâm' },
        { id: generateId(), name: 'Xe dự phòng 03', code: 'TRUCK-003', status: 'MAINTENANCE', location: 'Kho trung tâm' },
      ];
      await database.write(async () => {
        const truckTable = database.get<Truck>('trucks');
        for (const t of truckDefs) {
          await truckTable.create((record: any) => {
            record._raw.id = t.id;
            record.name = t.name;
            record.code = t.code;
            record.status = t.status;
            record.location = t.location;
          });
        }
      });
      trucks = await database.get<Truck>('trucks').query().fetch();
    }

    // --- Inventory Items ---
    let inventoryItems = await database.get<InventoryItem>('inventory_items').query().fetch();
    if (inventoryItems.length === 0) {
      const itemDefs = [
        // Thành phẩm (bán ra)
        { id: generateId(), name: 'Cà phê sữa đá', sku: 'PRD-COF-001', unit: 'ly', quantity: '120', reorderLevel: '20', price: '25000', category: 'Đồ uống', isRawMaterial: false },
        { id: generateId(), name: 'Bánh mì thịt', sku: 'PRD-BMI-001', unit: 'ổ', quantity: '60', reorderLevel: '15', price: '30000', category: 'Đồ ăn', isRawMaterial: false },
        { id: generateId(), name: 'Trà đào cam sả', sku: 'PRD-TEA-001', unit: 'ly', quantity: '50', reorderLevel: '10', price: '32000', category: 'Đồ uống', isRawMaterial: false },
        { id: generateId(), name: 'Nước ép cam', sku: 'PRD-JUI-001', unit: 'ly', quantity: '40', reorderLevel: '10', price: '28000', category: 'Đồ uống', isRawMaterial: false },
        { id: generateId(), name: 'Cà phê đen', sku: 'PRD-COF-002', unit: 'ly', quantity: '80', reorderLevel: '15', price: '20000', category: 'Đồ uống', isRawMaterial: false },
        { id: generateId(), name: 'Bánh mì chảo', sku: 'PRD-BMI-002', unit: 'suất', quantity: '30', reorderLevel: '10', price: '45000', category: 'Đồ ăn', isRawMaterial: false },
        { id: generateId(), name: 'Sinh tố bơ', sku: 'PRD-SMO-001', unit: 'ly', quantity: '25', reorderLevel: '8', price: '35000', category: 'Đồ uống', isRawMaterial: false },
        { id: generateId(), name: 'Nước suối', sku: 'PRD-WAT-001', unit: 'chai', quantity: '200', reorderLevel: '30', price: '10000', category: 'Đồ uống', isRawMaterial: false },
        // Nguyên liệu thô
        { id: generateId(), name: 'Cà phê hạt', sku: 'MAT-COF-001', unit: 'kg', quantity: '30', reorderLevel: '5', price: '180000', category: 'Nguyên liệu', isRawMaterial: true },
        { id: generateId(), name: 'Sữa đặc', sku: 'MAT-MIL-001', unit: 'lon', quantity: '80', reorderLevel: '10', price: '22000', category: 'Nguyên liệu', isRawMaterial: true },
        { id: generateId(), name: 'Bánh mì ổ', sku: 'MAT-BRD-001', unit: 'ổ', quantity: '150', reorderLevel: '20', price: '5000', category: 'Nguyên liệu', isRawMaterial: true },
        { id: generateId(), name: 'Thịt nguội', sku: 'MAT-HAM-001', unit: 'kg', quantity: '20', reorderLevel: '5', price: '160000', category: 'Nguyên liệu', isRawMaterial: true },
        { id: generateId(), name: 'Trái đào ngâm', sku: 'MAT-PEA-001', unit: 'hộp', quantity: '25', reorderLevel: '5', price: '65000', category: 'Nguyên liệu', isRawMaterial: true },
        { id: generateId(), name: 'Cam tươi', sku: 'MAT-ORA-001', unit: 'kg', quantity: '45', reorderLevel: '8', price: '30000', category: 'Nguyên liệu', isRawMaterial: true },
        { id: generateId(), name: 'Đá viên', sku: 'MAT-ICE-001', unit: 'kg', quantity: '80', reorderLevel: '10', price: '4000', category: 'Nguyên liệu', isRawMaterial: true },
        { id: generateId(), name: 'Bơ sáp', sku: 'MAT-AVO-001', unit: 'kg', quantity: '15', reorderLevel: '5', price: '70000', category: 'Nguyên liệu', isRawMaterial: true },
        { id: generateId(), name: 'Đường', sku: 'MAT-SUG-001', unit: 'kg', quantity: '40', reorderLevel: '8', price: '15000', category: 'Nguyên liệu', isRawMaterial: true },
      ];
      await database.write(async () => {
        const itemTable = database.get<InventoryItem>('inventory_items');
        for (const item of itemDefs) {
          await itemTable.create((record: any) => {
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
      });
      inventoryItems = await database.get<InventoryItem>('inventory_items').query().fetch();
    }

    // --- Menu Items (for POS) ---
    let menuItems = await database.get<MenuItem>('menu_items').query().fetch();
    if (menuItems.length === 0) {
      const menuDefs = [
        { id: generateId(), name: 'Cà phê sữa đá', price: '25000', category: 'Đồ uống', unit: 'ly', defaultDiscount: '0', isActive: true },
        { id: generateId(), name: 'Cà phê đen', price: '20000', category: 'Đồ uống', unit: 'ly', defaultDiscount: '0', isActive: true },
        { id: generateId(), name: 'Trà đào cam sả', price: '32000', category: 'Đồ uống', unit: 'ly', defaultDiscount: '5', isActive: true },
        { id: generateId(), name: 'Nước ép cam', price: '28000', category: 'Đồ uống', unit: 'ly', defaultDiscount: '0', isActive: true },
        { id: generateId(), name: 'Sinh tố bơ', price: '35000', category: 'Đồ uống', unit: 'ly', defaultDiscount: '0', isActive: true },
        { id: generateId(), name: 'Nước suối', price: '10000', category: 'Đồ uống', unit: 'chai', defaultDiscount: '0', isActive: true },
        { id: generateId(), name: 'Bánh mì thịt', price: '30000', category: 'Đồ ăn', unit: 'ổ', defaultDiscount: '0', isActive: true },
        { id: generateId(), name: 'Bánh mì chảo', price: '45000', category: 'Đồ ăn', unit: 'suất', defaultDiscount: '10', isActive: true },
      ];
      await database.write(async () => {
        const menuTable = database.get<MenuItem>('menu_items');
        for (const m of menuDefs) {
          await menuTable.create((record: any) => {
            record._raw.id = m.id;
            record.name = m.name;
            record.price = m.price;
            record.category = m.category;
            record.unit = m.unit;
            record.defaultDiscount = m.defaultDiscount;
            record.isActive = m.isActive;
            record.createdAt = Date.now();
            record.updatedAt = Date.now();
          });
        }
      });
      menuItems = await database.get<MenuItem>('menu_items').query().fetch();

      // --- Menu Ingredients (BOM for each menu item) ---
      // Map material names to their IDs
      const matMap: Record<string, any> = {};
      for (const item of inventoryItems) {
        if (item.isRawMaterial) {
          matMap[item.name] = item;
        }
      }

      const ingredientDefs: Array<{ menuItemName: string; materialName: string; quantity: string; unit: string }> = [
        // Cà phê sữa đá: 0.02kg cà phê hạt + 0.5 lon sữa đặc + 0.3kg đá + 0.05kg đường
        { menuItemName: 'Cà phê sữa đá', materialName: 'Cà phê hạt', quantity: '0.02', unit: 'kg' },
        { menuItemName: 'Cà phê sữa đá', materialName: 'Sữa đặc', quantity: '0.5', unit: 'lon' },
        { menuItemName: 'Cà phê sữa đá', materialName: 'Đá viên', quantity: '0.3', unit: 'kg' },
        { menuItemName: 'Cà phê sữa đá', materialName: 'Đường', quantity: '0.05', unit: 'kg' },
        // Cà phê đen: 0.02kg cà phê hạt + 0.3kg đá
        { menuItemName: 'Cà phê đen', materialName: 'Cà phê hạt', quantity: '0.02', unit: 'kg' },
        { menuItemName: 'Cà phê đen', materialName: 'Đá viên', quantity: '0.3', unit: 'kg' },
        // Trà đào cam sả: 0.5 hộp đào + 0.3kg cam + 0.2kg đá
        { menuItemName: 'Trà đào cam sả', materialName: 'Trái đào ngâm', quantity: '0.5', unit: 'hộp' },
        { menuItemName: 'Trà đào cam sả', materialName: 'Cam tươi', quantity: '0.3', unit: 'kg' },
        { menuItemName: 'Trà đào cam sả', materialName: 'Đá viên', quantity: '0.2', unit: 'kg' },
        // Nước ép cam: 0.5kg cam
        { menuItemName: 'Nước ép cam', materialName: 'Cam tươi', quantity: '0.5', unit: 'kg' },
        // Sinh tố bơ: 0.3kg bơ + 0.2 lon sữa đặc + 0.3kg đá
        { menuItemName: 'Sinh tố bơ', materialName: 'Bơ sáp', quantity: '0.3', unit: 'kg' },
        { menuItemName: 'Sinh tố bơ', materialName: 'Sữa đặc', quantity: '0.2', unit: 'lon' },
        { menuItemName: 'Sinh tố bơ', materialName: 'Đá viên', quantity: '0.3', unit: 'kg' },
        // Bánh mì thịt: 1 ổ bánh mì + 0.15kg thịt nguội
        { menuItemName: 'Bánh mì thịt', materialName: 'Bánh mì ổ', quantity: '1', unit: 'ổ' },
        { menuItemName: 'Bánh mì thịt', materialName: 'Thịt nguội', quantity: '0.15', unit: 'kg' },
        // Bánh mì chảo: 2 ổ bánh mì + 0.3kg thịt nguội
        { menuItemName: 'Bánh mì chảo', materialName: 'Bánh mì ổ', quantity: '2', unit: 'ổ' },
        { menuItemName: 'Bánh mì chảo', materialName: 'Thịt nguội', quantity: '0.3', unit: 'kg' },
      ];

      await database.write(async () => {
        const ingTable = database.get<MenuIngredient>('menu_ingredients');
        for (const def of ingredientDefs) {
          const menuItem = menuItems.find((m: any) => m.name === def.menuItemName);
          const material = matMap[def.materialName];
          if (menuItem && material) {
            await ingTable.create((record: any) => {
              record._raw.id = generateId();
              record.menuItemId = menuItem.id;
              record.materialId = material.id;
              record.materialName = material.name;
              record.quantity = def.quantity;
              record.unit = def.unit;
              record.createdAt = Date.now();
              record.updatedAt = Date.now();
            });
          }
        }
      });
    }

    // --- Suppliers ---
    let suppliers = await database.get<Supplier>('suppliers').query().fetch();
    if (suppliers.length === 0) {
      const supplierDefs = [
        { id: generateId(), name: 'Viet Beans Co., Ltd.', phone: '0901112233', address: 'Bình Thạnh, TP.HCM', note: 'Nhà cung cấp hạt cà phê' },
        { id: generateId(), name: 'Fresh Dairy Supply', phone: '0902223344', address: 'Dĩ An, Bình Dương', note: 'Nhà cung cấp sữa và nguyên liệu lạnh' },
        { id: generateId(), name: 'Bakery House', phone: '0903334455', address: 'Quận 1, TP.HCM', note: 'Nhà cung cấp bánh mì' },
        { id: generateId(), name: 'MeatPro VN', phone: '0904445566', address: 'Hóc Môn, TP.HCM', note: 'Nhà cung cấp thịt nguội, thịt tươi' },
        { id: generateId(), name: 'Ice Factory Co.', phone: '0905556677', address: 'Thủ Đức, TP.HCM', note: 'Nhà cung cấp đá viên' },
      ];
      await database.write(async () => {
        const supTable = database.get<Supplier>('suppliers');
        for (const s of supplierDefs) {
          await supTable.create((record: any) => {
            record._raw.id = s.id;
            record.name = s.name;
            record.phone = s.phone;
            record.address = s.address;
            record.note = s.note;
          });
        }
      });
      suppliers = await database.get<Supplier>('suppliers').query().fetch();
    }

    // --- Build product catalog (chỉ thành phẩm) ---
    const products: ProductDef[] = inventoryItems
      .filter((i: any) => !i.isRawMaterial)
      .map((i: any) => ({
        id: i.id,
        name: i.name,
        price: parseInt(i.price) || 0,
        category: i.category,
        unit: i.unit,
      }));

    // --- Raw materials ---
    const rawMaterials: RawMaterialDef[] = inventoryItems
      .filter((i: any) => i.isRawMaterial)
      .map((i: any) => ({
        id: i.id,
        name: i.name,
        unit: i.unit,
      }));

    // ====================================================================
    // PHASE 2: ĐỊNH NGHĨA NHÂN VIÊN
    // ====================================================================
    const employeeDefs: EmployeeDef[] = [
      { id: generateId(), name: 'Nguyễn Văn An', phone: '0903000001', role: 'Thu ngân', salary: 8000000, status: 'ACTIVE' },
      { id: generateId(), name: 'Trần Thị Bình', phone: '0903000002', role: 'Nhân viên kho', salary: 9000000, status: 'ACTIVE' },
      { id: generateId(), name: 'Lê Minh Quân', phone: '0903000003', role: 'Bếp chính', salary: 9500000, status: 'ACTIVE' },
      { id: generateId(), name: 'Phạm Thu Hà', phone: '0903000004', role: 'Kế toán', salary: 8500000, status: 'ACTIVE' },
      { id: generateId(), name: 'Hoàng Văn Tùng', phone: '0903000005', role: 'Bếp phụ', salary: 7000000, status: 'ACTIVE' },
      { id: generateId(), name: 'Đỗ Thị Mai', phone: '0903000006', role: 'Thu ngân', salary: 8000000, status: 'ACTIVE' },
      { id: generateId(), name: 'Vũ Quốc Huy', phone: '0903000007', role: 'Nhân viên bán hàng', salary: 7500000, status: 'ACTIVE' },
      { id: generateId(), name: 'Lý Thị Hồng', phone: '0903000008', role: 'Nhân viên bán hàng', salary: 7500000, status: 'ACTIVE' },
      { id: generateId(), name: 'Ngô Minh Tuấn', phone: '0903000009', role: 'Bếp phụ', salary: 7000000, status: 'ACTIVE' },
      { id: generateId(), name: 'Bùi Thị Lan', phone: '0903000010', role: 'Kế toán', salary: 8500000, status: 'ACTIVE' },
      { id: generateId(), name: 'Trịnh Văn Đức', phone: '0903000011', role: 'Quản lý', salary: 12000000, status: 'ACTIVE' },
      { id: generateId(), name: 'Dương Thị Nga', phone: '0903000012', role: 'Nhân viên bán hàng', salary: 7500000, status: 'INACTIVE' },
    ];

    // Department and truck assignments for employees
    const employeeAssignments: Record<string, { department: string; truckId: string }> = {
      'Nguyễn Văn An': { department: 'Bán hàng', truckId: '' },
      'Trần Thị Bình': { department: 'Kho', truckId: '' },
      'Lê Minh Quân': { department: 'Bếp', truckId: '' },
      'Phạm Thu Hà': { department: 'Kế toán', truckId: '' },
      'Hoàng Văn Tùng': { department: 'Bếp', truckId: '' },
      'Đỗ Thị Mai': { department: 'Bán hàng', truckId: '' },
      'Vũ Quốc Huy': { department: 'Bán hàng', truckId: '' },
      'Lý Thị Hồng': { department: 'Bán hàng', truckId: '' },
      'Ngô Minh Tuấn': { department: 'Bếp', truckId: '' },
      'Bùi Thị Lan': { department: 'Kế toán', truckId: '' },
      'Trịnh Văn Đức': { department: 'Quản lý', truckId: '' },
      'Dương Thị Nga': { department: 'Bán hàng', truckId: '' },
    };

    // ====================================================================
    // PHASE 3: MÔ PHỎNG 3 NGÀY BÁN HÀNG
    // ====================================================================
    const allOrders: any[] = [];
    const allOrderLines: any[] = [];
    const allStockMovements: any[] = [];
    const allTransactions: any[] = [];
    const allShifts: any[] = [];
    const allAttendances: any[] = [];
    const allAdvances: any[] = [];

    const paymentMethods = ['cash', 'cash', 'cash', 'qr', 'card'];
    const activeTrucks = trucks.filter((t: any) => t.status === 'ACTIVE');
    const activeEmployees = employeeDefs.filter((e: any) => e.status === 'ACTIVE');

    // Mô phỏng 3 ngày: dayOffset = 1 (hôm qua), 2 (hôm kia), 3 (3 ngày trước)
    for (const dayOffset of [1, 2, 3]) {
      // ================================================================
      // BƯỚC 1: SÁNG SỚM (6:00) - NHẬP KHO NGUYÊN LIỆU
      // ================================================================
      const morningTime = dayTime(dayOffset, 6, 0);

      const numReceives = randomBetween(2, 3);
      const usedMaterials = new Set<string>();
      for (let r = 0; r < numReceives; r++) {
        let material = pickRandom(rawMaterials);
        let attempts = 0;
        while (usedMaterials.has(material.id) && attempts < 5) {
          material = pickRandom(rawMaterials);
          attempts++;
        }
        usedMaterials.add(material.id);

        const supplier = pickRandom(suppliers);
        const qty = material.name === 'Cà phê hạt' ? randomBetween(3, 8) :
                    material.name === 'Sữa đặc' ? randomBetween(10, 20) :
                    material.name === 'Bánh mì ổ' ? randomBetween(30, 60) :
                    material.name === 'Đá viên' ? randomBetween(20, 40) :
                    randomBetween(5, 15);

        allStockMovements.push({
          id: generateId(),
          itemId: material.id,
          itemName: material.name,
          quantity: qty.toString(),
          type: 'RECEIVE',
          referenceId: supplier.id,
          note: `Nhập kho sáng ngày ${dayOffset === 1 ? 'hôm qua' : dayOffset === 2 ? 'hôm kia' : '3 ngày trước'} - từ ${supplier.name}`,
          createdAt: morningTime + randomBetween(0, 30) * 60 * 1000,
          updatedAt: morningTime + randomBetween(0, 30) * 60 * 1000,
        });

        const unitPrice = material.name === 'Cà phê hạt' ? 180000 :
                          material.name === 'Sữa đặc' ? 22000 :
                          material.name === 'Bánh mì ổ' ? 5000 :
                          material.name === 'Thịt nguội' ? 160000 :
                          material.name === 'Trái đào ngâm' ? 65000 :
                          material.name === 'Cam tươi' ? 30000 :
                          material.name === 'Đá viên' ? 4000 :
                          material.name === 'Bơ sáp' ? 70000 :
                          material.name === 'Đường' ? 15000 : 50000;
        const totalCost = qty * unitPrice;

        allTransactions.push({
          id: generateId(),
          type: 'EXPENSE',
          category: 'Nhập hàng',
          amount: totalCost.toString(),
          note: `Nhập ${material.name} (${qty} ${material.unit}) từ ${supplier.name}`,
          referenceType: 'supplier_invoice',
          referenceId: supplier.id,
          createdAt: morningTime + randomBetween(0, 30) * 60 * 1000,
          updatedAt: morningTime + randomBetween(0, 30) * 60 * 1000,
        });
      }

      // ================================================================
      // BƯỚC 2: SÁNG (6:30) - XUẤT NGUYÊN LIỆU CHO XE BÁN HÀNG
      // ================================================================
      const transferTime = dayTime(dayOffset, 6, 30);

      for (const truck of activeTrucks) {
        const numMaterials = randomBetween(3, 5);
        const truckMaterials = new Set<string>();
        for (let m = 0; m < numMaterials; m++) {
          let material = pickRandom(rawMaterials);
          let attempts = 0;
          while (truckMaterials.has(material.id) && attempts < 5) {
            material = pickRandom(rawMaterials);
            attempts++;
          }
          truckMaterials.add(material.id);

          const qty = material.name === 'Cà phê hạt' ? randomBetween(1, 3) :
                      material.name === 'Sữa đặc' ? randomBetween(5, 10) :
                      material.name === 'Bánh mì ổ' ? randomBetween(20, 40) :
                      material.name === 'Đá viên' ? randomBetween(10, 20) :
                      randomBetween(2, 8);

          // TRANSFER_OUT từ kho
          allStockMovements.push({
            id: generateId(),
            itemId: material.id,
            itemName: material.name,
            quantity: `-${qty}`,
            type: 'TRANSFER_OUT',
            referenceId: truck.code,
            note: `Xuất ${material.name} cho ${truck.name} - Ca sáng`,
            createdAt: transferTime + m * 5 * 60 * 1000,
            updatedAt: transferTime + m * 5 * 60 * 1000,
          });

          // TRANSFER_IN vào xe
          allStockMovements.push({
            id: generateId(),
            itemId: material.id,
            itemName: material.name,
            quantity: qty.toString(),
            type: 'TRANSFER_IN',
            referenceId: truck.code,
            note: `Nhận ${material.name} từ kho - ${truck.name}`,
            createdAt: transferTime + m * 5 * 60 * 1000 + 1000,
            updatedAt: transferTime + m * 5 * 60 * 1000 + 1000,
          });
        }
      }

      // ================================================================
      // BƯỚC 3: SÁNG (6:45-7:00) - NHÂN VIÊN CHẤM CÔNG CHECK-IN
      // ================================================================
      const checkInWindow = dayTime(dayOffset, 6, 45);

      for (const emp of activeEmployees) {
        if (Math.random() > 0.85) continue;

        const checkInTime = checkInWindow + randomBetween(0, 30) * 60 * 1000;
        allAttendances.push({
          id: generateId(),
          employeeId: emp.id,
          date: dayTime(dayOffset, 0, 0),
          checkIn: checkInTime,
          checkOut: 0,
          note: 'Đi làm',
          createdAt: checkInTime,
          updatedAt: checkInTime,
        });
      }

      // ================================================================
      // BƯỚC 4: SÁNG (7:00) - MỞ CA, NHẬN TIỀN ĐẦU CA
      // ================================================================
      const shiftOpenTime = dayTime(dayOffset, 7, 0);

      for (const truck of activeTrucks) {
        const staff = pickRandom(activeEmployees);
        const openingBalance = randomBetween(200000, 500000);

        allShifts.push({
          id: generateId(),
          truckId: truck.code,
          staffName: staff.name,
          openingBalance: openingBalance.toString(),
          closingBalance: '0',
          expectedBalance: '0',
          difference: '0',
          status: 'OPEN',
          openedAt: shiftOpenTime,
          closedAt: 0,
          note: `Mở ca sáng - ${truck.name}`,
          createdAt: shiftOpenTime,
          updatedAt: shiftOpenTime,
        });
      }

      // ================================================================
      // BƯỚC 5-7: CẢ NGÀY (7:00-22:00) - BÁN HÀNG
      // ================================================================
      const numOrders = randomBetween(15, 25);

      for (let o = 0; o < numOrders; o++) {
        let hour: number;
        const rand = Math.random();
        if (rand < 0.3) {
          hour = randomBetween(11, 13);
        } else if (rand < 0.6) {
          hour = randomBetween(17, 20);
        } else {
          hour = randomBetween(7, 21);
        }
        const minute = randomBetween(0, 59);
        const orderTime = dayTime(dayOffset, hour, minute);

        const truck = pickRandom(activeTrucks);
        const paymentMethod = pickRandom(paymentMethods);
        const discount = Math.random() > 0.7 ? randomBetween(0, 15) : 0;

        const numItems = randomBetween(1, 4);
        const selectedProducts: ProductDef[] = [];
        const usedIds = new Set<string>();
        for (let j = 0; j < numItems; j++) {
          const product = pickRandom(products);
          if (!usedIds.has(product.id)) {
            usedIds.add(product.id);
            selectedProducts.push(product);
          }
        }
        if (selectedProducts.length === 0) continue;

        const items = selectedProducts.map((p) => ({
          productId: p.id,
          productName: p.name,
          price: p.price,
          qty: randomBetween(1, 4),
        }));

        const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
        const discountAmount = total * (discount / 100);
        const finalTotal = total - discountAmount;
        const cashReceived = paymentMethod === 'cash' ? Math.ceil(finalTotal / 10000) * 10000 : finalTotal;
        const changeAmount = paymentMethod === 'cash' ? Math.max(0, cashReceived - finalTotal) : 0;

        const orderId = generateId();
        const orderNote = Math.random() > 0.8 ?
          pickRandom(['Khách quen', 'Giờ cao điểm', 'Đặt trước', 'Mang về', 'Ăn tại xe', 'Gọi thêm']) : '';

        allOrders.push({
          id: orderId,
          totalAmount: formatCurrency(finalTotal),
          status: 'COMPLETED',
          paymentMethod,
          cashReceived: formatCurrency(cashReceived),
          changeAmount: formatCurrency(changeAmount),
          discount: discount.toString(),
          note: orderNote,
          truckId: truck.code,
          createdAt: orderTime,
          updatedAt: orderTime,
        });

        for (const item of items) {
          allOrderLines.push({
            id: generateId(),
            orderId,
            productId: item.productId,
            productName: item.productName,
            quantity: item.qty.toString(),
            price: formatCurrency(item.price),
            subtotal: formatCurrency(item.price * item.qty),
            createdAt: orderTime,
            updatedAt: orderTime,
          });
        }

        for (const item of items) {
          allStockMovements.push({
            id: generateId(),
            itemId: item.productId,
            itemName: item.productName,
            quantity: `-${item.qty}`,
            type: 'SALE',
            referenceId: orderId,
            note: `Bán hàng - ${item.productName} x${item.qty}${orderNote ? ' (' + orderNote + ')' : ''}`,
            createdAt: orderTime,
            updatedAt: orderTime,
          });
        }

        allTransactions.push({
          id: generateId(),
          type: 'INCOME',
          category: 'Bán hàng',
          amount: formatCurrency(finalTotal),
          note: `Thu tiền đơn hàng #${o + 1} - ${items.map((it) => `${it.productName}x${it.qty}`).join(', ')}`,
          referenceType: 'pos_order',
          referenceId: orderId,
          createdAt: orderTime,
          updatedAt: orderTime,
        });
      }

      // ================================================================
      // BƯỚC 8: CUỐI NGÀY (22:00-22:30) - KẾT CA
      // ================================================================
      const shiftCloseTime = dayTime(dayOffset, 22, 0);

      for (const truck of activeTrucks) {
        const shift = allShifts.find((s: any) => s.truckId === truck.code);
        if (!shift) continue;

        const truckOrders = allOrders.filter((o: any) => o.truckId === truck.code);
        const truckSales = truckOrders.reduce((sum: number, o: any) => sum + parseFloat(o.totalAmount), 0);

        const openingBal = parseFloat(shift.openingBalance);
        const expectedBal = openingBal + truckSales;
        const diff = Math.random() > 0.8 ? randomBetween(-10000, 10000) : 0;
        const closingBal = expectedBal + diff;

        shift.closingBalance = formatCurrency(closingBal);
        shift.expectedBalance = formatCurrency(expectedBal);
        shift.difference = formatCurrency(diff);
        shift.status = 'CLOSED';
        shift.closedAt = shiftCloseTime + randomBetween(0, 30) * 60 * 1000;
        shift.note = diff === 0 ? 'Kết ca - Không chênh lệch' :
                     diff > 0 ? `Kết ca - Dư ${diff.toLocaleString()}đ` :
                                `Kết ca - Thiếu ${Math.abs(diff).toLocaleString()}đ`;
        shift.updatedAt = shift.closedAt;
      }

      // ================================================================
      // BƯỚC 9: CUỐI NGÀY (22:30) - KIỂM KÊ NGUYÊN LIỆU TỒN KHO
      // ================================================================
      const inventoryCheckTime = dayTime(dayOffset, 22, 30);

      // Kiểm kê 2-3 loại nguyên liệu mỗi ngày
      const numChecks = randomBetween(2, 3);
      const checkedMaterials = new Set<string>();
      for (let c = 0; c < numChecks; c++) {
        let material = pickRandom(rawMaterials);
        let attempts = 0;
        while (checkedMaterials.has(material.id) && attempts < 5) {
          material = pickRandom(rawMaterials);
          attempts++;
        }
        checkedMaterials.add(material.id);

        const isPositive = Math.random() > 0.5;
        const qty = randomBetween(1, 5);

        allStockMovements.push({
          id: generateId(),
          itemId: material.id,
          itemName: material.name,
          quantity: isPositive ? qty.toString() : `-${qty}`,
          type: 'ADJUSTMENT',
          referenceId: `ADJ-${dayOffset}-${c + 1}`,
          note: isPositive ? `Kiểm kê cuối ngày - dư ${qty} ${material.unit}` :
                             `Kiểm kê cuối ngày - thiếu ${qty} ${material.unit}`,
          createdAt: inventoryCheckTime + c * 5 * 60 * 1000,
          updatedAt: inventoryCheckTime + c * 5 * 60 * 1000,
        });
      }

      // ================================================================
      // BƯỚC 10: CUỐI NGÀY (22:30-23:00) - NHÂN VIÊN CHECK-OUT
      // ================================================================
      const checkOutWindow = dayTime(dayOffset, 22, 30);

      for (const attendance of allAttendances) {
        if (attendance.employeeId && attendance.checkOut === 0) {
          attendance.checkOut = checkOutWindow + randomBetween(0, 30) * 60 * 1000;
          attendance.note = 'Đã ra về';
          attendance.updatedAt = attendance.checkOut;
        }
      }

      // ================================================================
      // BƯỚC 11: CUỐI NGÀY - GHI NHẬN CHI PHÍ PHÁT SINH
      // ================================================================
      const expenseTime = dayTime(dayOffset, 22, 45);

      // Chi phí điện (mỗi ngày)
      allTransactions.push({
        id: generateId(),
        type: 'EXPENSE',
        category: 'Điện nước',
        amount: randomBetween(150000, 400000).toString(),
        note: `Tiền điện ngày ${dayOffset === 1 ? 'hôm qua' : dayOffset === 2 ? 'hôm kia' : '3 ngày trước'}`,
        referenceType: 'utility',
        referenceId: `UTIL-ELEC-${dayOffset}`,
        createdAt: expenseTime,
        updatedAt: expenseTime,
      });

      // Chi phí vận chuyển (mỗi ngày)
      allTransactions.push({
        id: generateId(),
        type: 'EXPENSE',
        category: 'Vận chuyển',
        amount: randomBetween(50000, 200000).toString(),
        note: `Xăng xe đi lại ngày ${dayOffset === 1 ? 'hôm qua' : dayOffset === 2 ? 'hôm kia' : '3 ngày trước'}`,
        referenceType: 'utility',
        referenceId: `UTIL-FUEL-${dayOffset}`,
        createdAt: expenseTime,
        updatedAt: expenseTime,
      });

      // Chi phí bảo trì (cách ngày)
      if (dayOffset % 2 === 0) {
        allTransactions.push({
          id: generateId(),
          type: 'EXPENSE',
          category: 'Bảo trì',
          amount: randomBetween(100000, 500000).toString(),
          note: `Bảo dưỡng thiết bị ngày ${dayOffset === 2 ? 'hôm kia' : '3 ngày trước'}`,
          referenceType: 'utility',
          referenceId: `UTIL-MAINT-${dayOffset}`,
          createdAt: expenseTime + 5 * 60 * 1000,
          updatedAt: expenseTime + 5 * 60 * 1000,
        });
      }

      // Chi phí khác (ngẫu nhiên)
      if (Math.random() > 0.5) {
        allTransactions.push({
          id: generateId(),
          type: 'EXPENSE',
          category: 'Chi khác',
          amount: randomBetween(20000, 150000).toString(),
          note: pickRandom(['Mua văn phòng phẩm', 'Đồ dùng vệ sinh', 'Bao bì đóng gói', 'Chi phí tiếp khách']),
          referenceType: 'utility',
          referenceId: `UTIL-MISC-${dayOffset}`,
          createdAt: expenseTime + 10 * 60 * 1000,
          updatedAt: expenseTime + 10 * 60 * 1000,
        });
      }
    }

    // ====================================================================
    // PHASE 4: TẠO DỮ LIỆU TẠM ỨNG (ADVANCES) - RẢI ĐỀU TRONG 3 NGÀY
    // ====================================================================
    const advanceReasons = [
      'Tạm ứng xăng xe',
      'Tạm ứng mua vật tư',
      'Ứng lương',
      'Chi phí đi lại',
      'Mua đồ dùng cá nhân',
      'Chi phí sửa xe',
    ];

    for (let i = 0; i < 12; i++) {
      const dayOffset = pickRandom([1, 2, 3]);
      const hoursBack = randomBetween(1, 8);
      const advTime = dayTime(dayOffset, hoursBack, randomBetween(0, 59));
      const emp = pickRandom(activeEmployees);
      const amount = randomBetween(100000, 1000000);

      allAdvances.push({
        id: generateId(),
        employeeId: emp.id,
        employeeName: emp.name,
        amount: amount.toString(),
        note: pickRandom(advanceReasons),
        date: advTime,
        createdAt: advTime,
        updatedAt: advTime,
      });
    }

    // ====================================================================
    // PHASE 5: GHI DỮ LIỆU VÀO DATABASE
    // ====================================================================
    await database.write(async () => {
      // --- Write employees ---
      const empTable = database.get<Employee>('employees');
      for (const emp of employeeDefs) {
        const existing = await empTable.query().fetch();
        const exists = existing.find((e: any) => e.name === emp.name);
        if (!exists) {
          const assignment = employeeAssignments[emp.name] || { department: '', truckId: '' };
          await empTable.create((record: any) => {
            record._raw.id = emp.id;
            record.name = emp.name;
            record.phone = emp.phone;
            record.role = emp.role;
            record.salary = emp.salary.toString();
            record.status = emp.status;
            record.department = assignment.department;
            record.truckId = assignment.truckId;
          });
        }
      }

      // --- Write orders and order lines ---
      const orderTable = database.get<SalesOrder>('pos_order');
      const lineTable = database.get<SalesOrderLine>('pos_order_line');
      for (const order of allOrders) {
        await orderTable.create((record: any) => {
          record._raw.id = order.id;
          record.totalAmount = order.totalAmount;
          record.status = order.status;
          record.paymentMethod = order.paymentMethod;
          record.cashReceived = order.cashReceived;
          record.changeAmount = order.changeAmount;
          record.discount = order.discount;
          record.note = order.note;
          record.truckId = order.truckId;
          record.createdAt = order.createdAt;
          record.updatedAt = order.updatedAt;
        });
      }
      for (const line of allOrderLines) {
        await lineTable.create((record: any) => {
          record._raw.id = line.id;
          record.orderId = line.orderId;
          record.productId = line.productId;
          record.productName = line.productName;
          record.quantity = line.quantity;
          record.price = line.price;
          record.subtotal = line.subtotal;
          record.createdAt = line.createdAt;
          record.updatedAt = line.updatedAt;
        });
      }

      // --- Write stock movements ---
      const movementTable = database.get<StockMovement>('stock_movements');
      for (const mv of allStockMovements) {
        await movementTable.create((record: any) => {
          record._raw.id = mv.id;
          record.itemId = mv.itemId;
          record.itemName = mv.itemName;
          record.quantity = mv.quantity;
          record.type = mv.type;
          record.referenceId = mv.referenceId;
          record.note = mv.note;
          record.createdAt = mv.createdAt;
          record.updatedAt = mv.updatedAt;
        });
      }

      // --- Write transactions ---
      const transactionTable = database.get<Transaction>('transactions');
      for (const tx of allTransactions) {
        await transactionTable.create((record: any) => {
          record._raw.id = tx.id;
          record.type = tx.type;
          record.category = tx.category;
          record.amount = tx.amount;
          record.note = tx.note;
          record.referenceType = tx.referenceType;
          record.referenceId = tx.referenceId;
          record.createdAt = tx.createdAt;
          record.updatedAt = tx.updatedAt;
        });
      }

      // --- Write shifts ---
      const shiftTable = database.get<Shift>('shifts');
      for (const shift of allShifts) {
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
          record.createdAt = shift.createdAt;
          record.updatedAt = shift.updatedAt;
        });
      }

      // --- Write attendances ---
      const attendanceTable = database.get<Attendance>('attendance');
      for (const att of allAttendances) {
        await attendanceTable.create((record: any) => {
          record._raw.id = att.id;
          record.employeeId = att.employeeId;
          record.date = att.date;
          record.checkIn = att.checkIn;
          record.checkOut = att.checkOut;
          record.note = att.note;
          record.createdAt = att.createdAt;
          record.updatedAt = att.updatedAt;
        });
      }

      // --- Write advances ---
      const advanceTable = database.get<Advance>('advances');
      for (const adv of allAdvances) {
        await advanceTable.create((record: any) => {
          record._raw.id = adv.id;
          record.employeeId = adv.employeeId;
          record.employeeName = adv.employeeName;
          record.amount = adv.amount;
          record.note = adv.note;
          record.date = adv.date;
          record.createdAt = adv.createdAt;
          record.updatedAt = adv.updatedAt;
        });
      }
    });

    // ====================================================================
    // PHASE 6: LOG KẾT QUẢ
    // ====================================================================
    console.log('✅ Reports/Finance/HR test data seeding completed (v2):');
    console.log(`  - Employees: ${employeeDefs.length}`);
    console.log(`  - POS orders: ${allOrders.length}`);
    console.log(`  - Order lines: ${allOrderLines.length}`);
    console.log(`  - Stock movements: ${allStockMovements.length}`);
    console.log(`  - Transactions: ${allTransactions.length}`);
    console.log(`  - Shifts: ${allShifts.length}`);
    console.log(`  - Attendances: ${allAttendances.length}`);
    console.log(`  - Advances: ${allAdvances.length}`);

    localStorage.setItem(SEED_FLAG, '1');

    return {
      created: true,
      message: `Đã tạo dữ liệu test theo flow nghiệp vụ thực tế 3 ngày: Báo cáo (${allOrders.length} đơn), Thu chi (${allTransactions.length} giao dịch), Nhân sự (${employeeDefs.length} nhân viên, ${allAttendances.length} chấm công, ${allAdvances.length} tạm ứng).`,
    };
  } catch (error) {
    console.error('❌ Error during Reports/Finance/HR seed data creation:', error);
    return {
      created: false,
      message: `Lỗi tạo dữ liệu test: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Seed Test Data for Materials Report (Báo cáo nguyên liệu)
 * 
 * === MÔ PHỎNG 1 NGÀY LÀM VIỆC ĐẦY ĐỦ ===
 * 
 * File này TỰ TẠO toàn bộ dữ liệu: món, nguyên liệu, định lượng (BOM),
 * đơn bán hàng, phiếu xuất nhập kho - không phụ thuộc dữ liệu có sẵn.
 * 
 * LUỒNG NGHIỆP VỤ:
 * 
 * BUỔI SÁNG (6:00-7:00):
 *   1. Nhập kho tổng: Nhập nguyên liệu từ nhà cung cấp vào kho chính
 *   2. Xuất nguyên liệu cho xe: Chuyển nguyên liệu từ kho lên xe bán hàng
 * 
 * CẢ NGÀY (7:00-22:00):
 *   3. Bán hàng: Bán các sản phẩm (mỗi sản phẩm tiêu hao nguyên liệu theo BOM)
 * 
 * CUỐI NGÀY (22:00-23:00):
 *   4. Kiểm kê: Ghi nhận lượng nguyên liệu thực tế đã xuất
 * 
 * Dữ liệu được tạo cho NGÀY HÔM QUA (dayOffset=1) để dễ kiểm tra.
 * 
 * Run via: seedMaterialsReportData()
 */

import { database } from './index.js';
import { generateId } from '../shared/utils.js';

import SalesOrder from './models/SalesOrder.js';
import SalesOrderLine from './models/SalesOrderLine.js';
import StockMovement from './models/StockMovement.js';
import InventoryItem from './models/InventoryItem.js';
import MenuItem from './models/MenuItem.js';
import MenuIngredient from './models/MenuIngredient.js';

const SEED_FLAG = 'truckflow_materials_report_seeded_v2';

type SeedResult = {
  created: boolean;
  message: string;
};

type SeedOptions = {
  force?: boolean;
};

/** Get timestamp for a specific day/hour in the past */
function dayTime(dayOffset: number, hour: number, minute = 0): number {
  const d = new Date();
  d.setDate(d.getDate() - dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

function formatCurrency(amount: number): string {
  return amount.toFixed(2);
}

// ====================================================================
// ĐỊNH NGHĨA SẢN PHẨM & NGUYÊN LIỆU (tự tạo, không phụ thuộc dữ liệu có sẵn)
// ====================================================================

interface MaterialDef {
  name: string;
  unit: string;
  price: number; // giá nhập
}

interface BOMIngredient {
  materialName: string;
  quantity: number;
}

interface ProductDef {
  name: string;
  price: number;
  category: string;
  unit: string;
  ingredients: BOMIngredient[];
}

interface SalesPlan {
  productName: string;
  qty: number;
}

// Định nghĩa nguyên liệu
const MATERIALS: MaterialDef[] = [
  { name: 'Cà phê hạt', unit: 'kg', price: 120000 },
  { name: 'Sữa đặc', unit: 'lon', price: 25000 },
  { name: 'Đường', unit: 'kg', price: 20000 },
  { name: 'Đá viên', unit: 'kg', price: 5000 },
  { name: 'Trái đào ngâm', unit: 'hộp', price: 35000 },
  { name: 'Cam tươi', unit: 'kg', price: 30000 },
  { name: 'Bơ sáp', unit: 'kg', price: 80000 },
  { name: 'Bánh mì ổ', unit: 'ổ', price: 5000 },
  { name: 'Thịt nguội', unit: 'kg', price: 150000 },
  { name: 'Trà túi lọc', unit: 'gói', price: 2000 },
  { name: 'Sả cây', unit: 'cây', price: 1000 },
  { name: 'Nước suối', unit: 'chai', price: 5000 },
];

// Định nghĩa sản phẩm + định lượng (BOM)
const PRODUCTS: ProductDef[] = [
  {
    name: 'Cà phê sữa đá',
    price: 25000,
    category: 'Đồ uống',
    unit: 'ly',
    ingredients: [
      { materialName: 'Cà phê hạt', quantity: 0.02 },
      { materialName: 'Sữa đặc', quantity: 0.5 },
      { materialName: 'Đá viên', quantity: 0.3 },
      { materialName: 'Đường', quantity: 0.05 },
    ],
  },
  {
    name: 'Cà phê đen',
    price: 20000,
    category: 'Đồ uống',
    unit: 'ly',
    ingredients: [
      { materialName: 'Cà phê hạt', quantity: 0.02 },
      { materialName: 'Đá viên', quantity: 0.3 },
    ],
  },
  {
    name: 'Trà đào cam sả',
    price: 30000,
    category: 'Đồ uống',
    unit: 'ly',
    ingredients: [
      { materialName: 'Trái đào ngâm', quantity: 0.5 },
      { materialName: 'Cam tươi', quantity: 0.3 },
      { materialName: 'Đá viên', quantity: 0.2 },
      { materialName: 'Trà túi lọc', quantity: 1 },
      { materialName: 'Sả cây', quantity: 1 },
      { materialName: 'Đường', quantity: 0.03 },
    ],
  },
  {
    name: 'Nước ép cam',
    price: 35000,
    category: 'Đồ uống',
    unit: 'ly',
    ingredients: [
      { materialName: 'Cam tươi', quantity: 0.5 },
      { materialName: 'Đường', quantity: 0.02 },
      { materialName: 'Đá viên', quantity: 0.2 },
    ],
  },
  {
    name: 'Sinh tố bơ',
    price: 40000,
    category: 'Đồ uống',
    unit: 'ly',
    ingredients: [
      { materialName: 'Bơ sáp', quantity: 0.3 },
      { materialName: 'Sữa đặc', quantity: 0.2 },
      { materialName: 'Đá viên', quantity: 0.3 },
      { materialName: 'Đường', quantity: 0.03 },
    ],
  },
  {
    name: 'Bánh mì thịt',
    price: 15000,
    category: 'Đồ ăn',
    unit: 'ổ',
    ingredients: [
      { materialName: 'Bánh mì ổ', quantity: 1 },
      { materialName: 'Thịt nguội', quantity: 0.15 },
    ],
  },
  {
    name: 'Bánh mì chảo',
    price: 35000,
    category: 'Đồ ăn',
    unit: 'suất',
    ingredients: [
      { materialName: 'Bánh mì ổ', quantity: 2 },
      { materialName: 'Thịt nguội', quantity: 0.3 },
    ],
  },
  {
    name: 'Nước suối',
    price: 10000,
    category: 'Đồ uống',
    unit: 'chai',
    ingredients: [
      { materialName: 'Nước suối', quantity: 1 },
    ],
  },
];

// Kế hoạch bán hàng trong ngày
const SALES_PLAN: SalesPlan[] = [
  { productName: 'Cà phê sữa đá', qty: 20 },
  { productName: 'Cà phê đen', qty: 15 },
  { productName: 'Trà đào cam sả', qty: 10 },
  { productName: 'Nước ép cam', qty: 8 },
  { productName: 'Sinh tố bơ', qty: 5 },
  { productName: 'Bánh mì thịt', qty: 12 },
  { productName: 'Bánh mì chảo', qty: 6 },
  { productName: 'Nước suối', qty: 25 },
];

// Hệ số điều chỉnh xuất thực tế (để tạo chênh lệch)
const ACTUAL_EXPORT_ADJUSTMENTS: Record<string, number> = {
  'Cà phê hạt': 1.0,       // Xuất đúng
  'Sữa đặc': 0.95,         // Xuất thiếu 5% (thực tế dùng ít hơn)
  'Bánh mì ổ': 1.0,        // Xuất đúng
  'Thịt nguội': 1.1,       // Xuất dư 10% (có hao hụt)
  'Trái đào ngâm': 0.9,    // Xuất thiếu 10%
  'Cam tươi': 1.15,        // Xuất dư 15% (vắt cam bị hao)
  'Đá viên': 1.2,          // Xuất dư 20% (đá tan hao hụt nhiều)
  'Bơ sáp': 1.0,           // Xuất đúng
  'Đường': 0.85,           // Xuất thiếu 15% (dùng ít hơn định mức)
  'Trà túi lọc': 1.0,      // Xuất đúng
  'Sả cây': 0.9,           // Xuất thiếu 10%
  'Nước suối': 1.0,        // Xuất đúng
};

// ====================================================================
// HÀM CHÍNH
// ====================================================================

export async function seedMaterialsReportData(options: SeedOptions = {}): Promise<SeedResult> {
  const force = options.force ?? false;

  const hasSeedFlag = localStorage.getItem(SEED_FLAG);
  if (!force && hasSeedFlag) {
    console.log('✓ Materials report test data already seeded, skipping');
    return { created: false, message: 'Dữ liệu test Báo cáo Nguyên liệu đã có sẵn, bỏ qua.' };
  }

  if (force) {
    console.log('🔄 Force reimporting materials report test data...');
    const tablesToClear = [
      'menu_ingredients', 'menu_items', 'inventory_items',
      'pos_order_line', 'pos_order', 'stock_movements',
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
    const dayOffset = 1; // Hôm qua

    // ====================================================================
    // PHASE 1: TẠO NGUYÊN LIỆU (inventory_items - isRawMaterial = true)
    // ====================================================================

    console.log('📦 Tạo nguyên liệu...');
    const materialRecords: Record<string, { id: string; name: string; unit: string }> = {};

    await database.write(async () => {
      const invTable = database.get<InventoryItem>('inventory_items');
      for (const mat of MATERIALS) {
        const id = generateId();
        const sku = `MAT-${mat.name.toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 10)}-${Date.now().toString(36).toUpperCase()}`;
        await invTable.create((record: any) => {
          record._raw.id = id;
          record.name = mat.name;
          record.sku = sku;
          record.unit = mat.unit;
          record.quantity = '0';
          record.reorderLevel = '5';
          record.price = mat.price.toString();
          record.category = 'Nguyên liệu';
          record.isRawMaterial = true;
          record.locationType = 'MAIN_WAREHOUSE';
          record.truckId = '';
          record.createdAt = Date.now();
          record.updatedAt = Date.now();
        });
        materialRecords[mat.name] = { id, name: mat.name, unit: mat.unit };
      }
    });
    console.log(`  ✅ Đã tạo ${MATERIALS.length} nguyên liệu`);

    // ====================================================================
    // PHASE 2: TẠO SẢN PHẨM (menu_items) + ĐỊNH LƯỢNG (menu_ingredients)
    // ====================================================================

    console.log('🍽️ Tạo sản phẩm và định lượng...');
    const productRecords: Record<string, { id: string; name: string; price: number }> = {};

    await database.write(async () => {
      const menuTable = database.get<MenuItem>('menu_items');
      const ingTable = database.get<MenuIngredient>('menu_ingredients');

      for (const prod of PRODUCTS) {
        const productId = generateId();

        // Tạo sản phẩm
        await menuTable.create((record: any) => {
          record._raw.id = productId;
          record.name = prod.name;
          record.price = prod.price.toString();
          record.category = prod.category;
          record.unit = prod.unit;
          record.defaultDiscount = '0';
          record.discountStart = 0;
          record.discountEnd = 0;
          record.isActive = true;
          record.createdAt = Date.now();
          record.updatedAt = Date.now();
        });

        productRecords[prod.name] = { id: productId, name: prod.name, price: prod.price };

        // Tạo định lượng (BOM)
        for (const ing of prod.ingredients) {
          const mat = materialRecords[ing.materialName];
          if (!mat) {
            console.warn(`  ⚠️ Không tìm thấy nguyên liệu "${ing.materialName}" cho sản phẩm "${prod.name}"`);
            continue;
          }
          await ingTable.create((record: any) => {
            record._raw.id = generateId();
            record.menuItemId = productId;
            record.materialId = mat.id;
            record.materialName = mat.name;
            record.quantity = ing.quantity.toString();
            record.unit = mat.unit;
            record.createdAt = Date.now();
            record.updatedAt = Date.now();
          });
        }
      }
    });
    console.log(`  ✅ Đã tạo ${PRODUCTS.length} sản phẩm với định lượng`);

    // ====================================================================
    // PHASE 3: TÍNH TOÁN NGUYÊN LIỆU CẦN THEO KẾ HOẠCH BÁN
    // ====================================================================

    const requiredMaterials: Record<string, { name: string; qty: number; unit: string }> = {};
    for (const plan of SALES_PLAN) {
      const prod = PRODUCTS.find(p => p.name === plan.productName);
      if (!prod) continue;
      for (const ing of prod.ingredients) {
        if (!requiredMaterials[ing.materialName]) {
          requiredMaterials[ing.materialName] = {
            name: ing.materialName,
            qty: 0,
            unit: materialRecords[ing.materialName]?.unit || '',
          };
        }
        requiredMaterials[ing.materialName].qty += ing.quantity * plan.qty;
      }
    }

    console.log('📊 Nguyên liệu cần theo BOM:');
    for (const [name, info] of Object.entries(requiredMaterials)) {
      console.log(`   ${name}: ${info.qty.toFixed(2)} ${info.unit}`);
    }

    // ====================================================================
    // PHASE 4: TẠO DỮ LIỆU GIAO DỊCH CHO 1 NGÀY
    // ====================================================================

    const allOrders: any[] = [];
    const allOrderLines: any[] = [];
    const allStockMovements: any[] = [];

    // --- BƯỚC 1: SÁNG (6:00) - NHẬP KHO TỔNG ---
    console.log('🏭 Bước 1: Nhập kho tổng...');
    const receiveTime = dayTime(dayOffset, 6, 0);
    let receiveIdx = 0;
    for (const [matName, info] of Object.entries(requiredMaterials)) {
      const mat = materialRecords[matName];
      if (!mat) continue;
      const receiveQty = Math.ceil(info.qty * 1.2); // Nhập 120% nhu cầu
      allStockMovements.push({
        id: generateId(),
        itemId: mat.id,
        itemName: mat.name,
        quantity: receiveQty.toString(),
        type: 'RECEIVE',
        referenceId: 'SUPPLIER-MAIN',
        note: `Nhập kho tổng: ${mat.name} ${receiveQty} ${mat.unit}`,
        createdAt: receiveTime + receiveIdx * 2 * 60 * 1000,
        updatedAt: receiveTime + receiveIdx * 2 * 60 * 1000,
      });
      receiveIdx++;
    }
    console.log(`  ✅ Đã nhập ${receiveIdx} loại nguyên liệu`);

    // --- BƯỚC 2: SÁNG (6:30) - XUẤT NGUYÊN LIỆU CHO XE BÁN HÀNG ---
    console.log('🚚 Bước 2: Xuất nguyên liệu cho xe...');
    const transferTime = dayTime(dayOffset, 6, 30);
    let transferIdx = 0;
    for (const [matName, info] of Object.entries(requiredMaterials)) {
      const mat = materialRecords[matName];
      if (!mat) continue;
      const exportQty = Math.ceil(info.qty); // Xuất đúng 100% nhu cầu BOM
      allStockMovements.push({
        id: generateId(),
        itemId: mat.id,
        itemName: mat.name,
        quantity: `-${exportQty}`,
        type: 'TRANSFER_OUT',
        referenceId: 'TRUCK-001',
        note: `Xuất ${mat.name} cho xe bán hàng: ${exportQty} ${mat.unit}`,
        createdAt: transferTime + transferIdx * 2 * 60 * 1000,
        updatedAt: transferTime + transferIdx * 2 * 60 * 1000,
      });
      transferIdx++;
    }
    console.log(`  ✅ Đã xuất ${transferIdx} loại nguyên liệu cho xe`);

    // --- BƯỚC 3: CẢ NGÀY (7:00-22:00) - BÁN HÀNG ---
    console.log('🛒 Bước 3: Bán hàng...');
    const saleStartTime = dayTime(dayOffset, 7, 0);
    let orderIdx = 0;
    let totalSoldQty = 0;

    for (const plan of SALES_PLAN) {
      const prod = productRecords[plan.productName];
      if (!prod) continue;

      let remainingQty = plan.qty;
      while (remainingQty > 0) {
        const batchQty = Math.min(remainingQty, Math.floor(Math.random() * 4) + 2);
        remainingQty -= batchQty;
        totalSoldQty += batchQty;

        const orderTime = saleStartTime + orderIdx * 15 * 60 * 1000;
        const subtotal = prod.price * batchQty;
        const orderId = generateId();

        allOrders.push({
          id: orderId,
          totalAmount: formatCurrency(subtotal),
          status: 'COMPLETED',
          paymentMethod: 'cash',
          cashReceived: formatCurrency(subtotal),
          changeAmount: '0',
          discount: '0',
          note: `Bán ${plan.productName} x${batchQty}`,
          truckId: 'TRUCK-001',
          createdAt: orderTime,
          updatedAt: orderTime,
        });

        allOrderLines.push({
          id: generateId(),
          orderId,
          productId: prod.id,
          productName: plan.productName,
          quantity: batchQty.toString(),
          price: formatCurrency(prod.price),
          subtotal: formatCurrency(subtotal),
          createdAt: orderTime,
          updatedAt: orderTime,
        });

        // Stock movement SALE cho thành phẩm
        allStockMovements.push({
          id: generateId(),
          itemId: prod.id,
          itemName: plan.productName,
          quantity: `-${batchQty}`,
          type: 'SALE',
          referenceId: orderId,
          note: `Bán hàng: ${plan.productName} x${batchQty}`,
          createdAt: orderTime,
          updatedAt: orderTime,
        });

        orderIdx++;
      }
    }
    console.log(`  ✅ Đã bán ${totalSoldQty} sản phẩm (${allOrders.length} đơn hàng)`);

    // --- BƯỚC 4: CUỐI NGÀY (22:00) - KIỂM KÊ & ĐIỀU CHỈNH ---
    console.log('📋 Bước 4: Kiểm kê cuối ngày...');
    const inventoryCheckTime = dayTime(dayOffset, 22, 0);
    let checkIdx = 0;

    for (const [matName, info] of Object.entries(requiredMaterials)) {
      const mat = materialRecords[matName];
      if (!mat) continue;

      const adjustmentFactor = ACTUAL_EXPORT_ADJUSTMENTS[matName] || 1.0;
      const actualExportQty = Math.ceil(info.qty * adjustmentFactor);
      const diff = actualExportQty - Math.ceil(info.qty);

      if (diff !== 0) {
        allStockMovements.push({
          id: generateId(),
          itemId: mat.id,
          itemName: mat.name,
          quantity: diff > 0 ? `-${Math.abs(diff)}` : Math.abs(diff).toString(),
          type: 'ADJUSTMENT',
          referenceId: `ADJ-DAYEND-${checkIdx + 1}`,
          note: diff > 0
            ? `Kiểm kê cuối ngày: hao hụt thêm ${Math.abs(diff)} ${mat.unit} ${mat.name}`
            : `Kiểm kê cuối ngày: dư ${Math.abs(diff)} ${mat.unit} ${mat.name}`,
          createdAt: inventoryCheckTime + checkIdx * 5 * 60 * 1000,
          updatedAt: inventoryCheckTime + checkIdx * 5 * 60 * 1000,
        });
        checkIdx++;
      }
    }
    console.log(`  ✅ Đã kiểm kê ${checkIdx} loại nguyên liệu có chênh lệch`);

    // ====================================================================
    // PHASE 5: GHI DỮ LIỆU VÀO DATABASE
    // ====================================================================

    console.log('💾 Ghi dữ liệu vào database...');

    await database.write(async () => {
      // --- Write orders ---
      const orderTable = database.get<SalesOrder>('pos_order');
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

      // --- Write order lines ---
      const lineTable = database.get<SalesOrderLine>('pos_order_line');
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
    });

    // ====================================================================
    // PHASE 6: LOG KẾT QUẢ
    // ====================================================================

    console.log('');
    console.log('✅ ====== SEED DỮ LIỆU BÁO CÁO NGUYÊN LIỆU HOÀN TẤT ======');
    console.log('');
    console.log('📋 TÓM TẮT:');
    console.log(`  - Nguyên liệu: ${MATERIALS.length} loại`);
    console.log(`  - Sản phẩm: ${PRODUCTS.length} món`);
    console.log(`  - Đơn bán hàng: ${allOrders.length}`);
    console.log(`  - Dòng bán hàng: ${allOrderLines.length}`);
    console.log(`  - Phiếu xuất nhập: ${allStockMovements.length}`);
    console.log('');
    console.log('📊 CHI TIẾT CHÊNH LỆCH NGUYÊN LIỆU:');
    console.log('  (Hệ thống = BOM × số lượng bán, Thực tế = xuất kho + kiểm kê)');
    console.log('');
    for (const [matName, info] of Object.entries(requiredMaterials)) {
      const adj = ACTUAL_EXPORT_ADJUSTMENTS[matName] || 1.0;
      const bomQty = Math.ceil(info.qty);
      const actualQty = Math.ceil(info.qty * adj);
      const diff = actualQty - bomQty;
      const diffSign = diff > 0 ? '+' : '';
      const diffPercent = ((diff / bomQty) * 100).toFixed(1);
      console.log(`  ${matName.padEnd(15)} | Hệ thống: ${bomQty.toString().padStart(5)} ${info.unit.padEnd(5)} | Thực tế: ${actualQty.toString().padStart(5)} ${info.unit.padEnd(5)} | Chênh lệch: ${diffSign}${diff} (${diffSign}${diffPercent}%)`);
    }

    localStorage.setItem(SEED_FLAG, '1');

    return {
      created: true,
      message: `Đã tạo dữ liệu test Báo cáo Nguyên liệu: ${MATERIALS.length} nguyên liệu, ${PRODUCTS.length} sản phẩm, ${allOrders.length} đơn bán, ${allStockMovements.length} phiếu xuất nhập.`,
    };
  } catch (error) {
    console.error('❌ Error during materials report seed data creation:', error);
    return {
      created: false,
      message: `Lỗi tạo dữ liệu test: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

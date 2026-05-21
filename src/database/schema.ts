/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 3,
  tables: [
    // ===== Inventory =====
    tableSchema({
      name: 'inventory_items',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'sku', type: 'string', isIndexed: true },
        { name: 'unit', type: 'string' },
        { name: 'quantity', type: 'string' },
        { name: 'reorder_level', type: 'string' },
        { name: 'price', type: 'string' },
        { name: 'category', type: 'string' },
        { name: 'is_raw_material', type: 'boolean' },
        { name: 'location_type', type: 'string' }, // MAIN_WAREHOUSE, TRUCK
        { name: 'truck_id', type: 'string' }, // which truck this item belongs to (if location_type=TRUCK)
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number', isIndexed: true },
      ],
    }),
    // ===== POS Orders =====
    tableSchema({
      name: 'pos_order',
      columns: [
        { name: 'total_amount', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'payment_method', type: 'string' },
        { name: 'cash_received', type: 'string' },
        { name: 'change_amount', type: 'string' },
        { name: 'discount', type: 'string' },
        { name: 'note', type: 'string' },
        { name: 'truck_id', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number', isIndexed: true },
      ],
    }),
    tableSchema({
      name: 'pos_order_line',
      columns: [
        { name: 'order_id', type: 'string', isIndexed: true },
        { name: 'product_id', type: 'string', isIndexed: true },
        { name: 'product_name', type: 'string' },
        { name: 'quantity', type: 'string' },
        { name: 'price', type: 'string' },
        { name: 'subtotal', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number', isIndexed: true },
      ],
    }),
    // ===== Stock Movements =====
    tableSchema({
      name: 'stock_movements',
      columns: [
        { name: 'item_id', type: 'string', isIndexed: true },
        { name: 'item_name', type: 'string' },
        { name: 'quantity', type: 'string' },
        { name: 'type', type: 'string' }, // RECEIVE, SALE, ADJUSTMENT, SPOILAGE, TRANSFER_OUT, TRANSFER_IN
        { name: 'reference_id', type: 'string' },
        { name: 'note', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number', isIndexed: true },
      ],
    }),
    // ===== BOM (Bill of Materials) =====
    tableSchema({
      name: 'bom_records',
      columns: [
        { name: 'product_id', type: 'string', isIndexed: true },
        { name: 'product_name', type: 'string' },
        { name: 'material_id', type: 'string', isIndexed: true },
        { name: 'material_name', type: 'string' },
        { name: 'quantity', type: 'string' },
        { name: 'unit', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number', isIndexed: true },
      ],
    }),
    // ===== Suppliers =====
    tableSchema({
      name: 'suppliers',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'phone', type: 'string' },
        { name: 'address', type: 'string' },
        { name: 'note', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number', isIndexed: true },
      ],
    }),
    // ===== Trucks =====
    tableSchema({
      name: 'trucks',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'code', type: 'string', isIndexed: true },
        { name: 'status', type: 'string' }, // ACTIVE, INACTIVE, MAINTENANCE
        { name: 'location', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number', isIndexed: true },
      ],
    }),
    // ===== Shift / Cash Session =====
    tableSchema({
      name: 'shifts',
      columns: [
        { name: 'truck_id', type: 'string' },
        { name: 'staff_name', type: 'string' },
        { name: 'opening_balance', type: 'string' },
        { name: 'closing_balance', type: 'string' },
        { name: 'expected_balance', type: 'string' },
        { name: 'difference', type: 'string' },
        { name: 'status', type: 'string' }, // OPEN, CLOSED
        { name: 'opened_at', type: 'number' },
        { name: 'closed_at', type: 'number' },
        { name: 'note', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number', isIndexed: true },
      ],
    }),
    // ===== Finance: Transactions =====
    tableSchema({
      name: 'transactions',
      columns: [
        { name: 'type', type: 'string' }, // INCOME, EXPENSE
        { name: 'category', type: 'string' },
        { name: 'amount', type: 'string' },
        { name: 'note', type: 'string' },
        { name: 'reference_type', type: 'string' },
        { name: 'reference_id', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number', isIndexed: true },
      ],
    }),
    // ===== HR: Employees =====
    tableSchema({
      name: 'employees',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'phone', type: 'string' },
        { name: 'role', type: 'string' },
        { name: 'salary', type: 'string' },
        { name: 'status', type: 'string' }, // ACTIVE, INACTIVE
        { name: 'department', type: 'string' },
        { name: 'truck_id', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number', isIndexed: true },
      ],
    }),
    // ===== HR: Attendance =====
    tableSchema({
      name: 'attendance',
      columns: [
        { name: 'employee_id', type: 'string', isIndexed: true },
        { name: 'date', type: 'number' },
        { name: 'check_in', type: 'number' },
        { name: 'check_out', type: 'number' },
        { name: 'note', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number', isIndexed: true },
      ],
    }),
    // ===== HR: Advances =====
    tableSchema({
      name: 'advances',
      columns: [
        { name: 'employee_id', type: 'string', isIndexed: true },
        { name: 'employee_name', type: 'string' },
        { name: 'amount', type: 'string' },
        { name: 'note', type: 'string' },
        { name: 'date', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number', isIndexed: true },
      ],
    }),
    // ===== Menu Items (Menu Configuration) =====
    tableSchema({
      name: 'menu_items',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'price', type: 'string' },
        { name: 'category', type: 'string' },
        { name: 'unit', type: 'string' },
        { name: 'default_discount', type: 'string' },
        { name: 'discount_start', type: 'number' },
        { name: 'discount_end', type: 'number' },
        { name: 'is_active', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number', isIndexed: true },
      ],
    }),
    // ===== Menu Item Ingredients (BOM for menu items) =====
    tableSchema({
      name: 'menu_ingredients',
      columns: [
        { name: 'menu_item_id', type: 'string', isIndexed: true },
        { name: 'material_id', type: 'string', isIndexed: true },
        { name: 'material_name', type: 'string' },
        { name: 'quantity', type: 'string' },
        { name: 'unit', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number', isIndexed: true },
      ],
    }),
    // ===== Auth: Users =====
    tableSchema({
      name: 'users',
      columns: [
        { name: 'username', type: 'string', isIndexed: true },
        { name: 'password', type: 'string' },
        { name: 'display_name', type: 'string' },
        { name: 'role', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'employee_id', type: 'string' },
        { name: 'module_access', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number', isIndexed: true },
      ],
    }),
  ],
});

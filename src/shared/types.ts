/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Decimal } from 'decimal.js';

export enum Role {
  TRUCK_STAFF = 'TRUCK_STAFF',
  TRUCK_MANAGER = 'TRUCK_MANAGER',
  SYSTEM_ADMIN = 'SYSTEM_ADMIN',
}

export enum StockStatus {
  OK = 'OK',
  NEEDS_AUDIT = 'NEEDS_AUDIT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
}

export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  unit: string;
  quantity: string; // Decimal string
  reorderLevel: string;
  updatedAt: number;
}

export interface StockMove {
  id: string;
  itemId: string;
  quantity: string; // Positive for add, negative for consume
  type: 'SALE' | 'ADJUSTMENT' | 'SPOILAGE' | 'RECEIVE';
  referenceId?: string;
  status: StockStatus;
  createdAt: number;
}

export interface OutboxEvent {
  id: string;
  type: string;
  payload: string;
  processed: boolean;
  createdAt: number;
}

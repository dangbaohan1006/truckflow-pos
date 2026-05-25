/**
 * Customer Order API Service
 * 
 * Handles communication with the backend for customer orders.
 * Customer-facing endpoints (create order) don't require auth.
 * Staff-facing endpoints require session token.
 */

import { getSessionToken, buildUrl } from '../auth/authApi.js';

const API_BASE = '/api/customer-orders';

// ===== Types =====

export interface OrderItemInput {
  menu_item_id: string;
  product_name: string;
  quantity: number;
  price: number;
  note: string;
}

export interface CreateOrderInput {
  table_number: string;
  customer_name: string;
  customer_phone: string;
  note: string;
  truck_id: string;
  items: OrderItemInput[];
}

export interface OrderItem {
  id: string;
  menu_item_id: string;
  product_name: string;
  quantity: number;
  price: number;
  note: string;
}

export interface CustomerOrder {
  id: string;
  table_number: string;
  customer_name: string;
  customer_phone: string;
  note: string;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  truck_id: string;
  staff_note: string;
  items: OrderItem[];
  created_at: number;
  updated_at: number;
}

export interface Notification {
  id: string;
  order_id: string;
  type: 'NEW_ORDER' | 'CONFIRMED' | 'UPDATED' | 'CANCELLED';
  message: string;
  is_read: boolean;
  created_at: number;
}

// ===== HTTP Helpers =====

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  authRequired = false,
): Promise<T> {
  const url = buildUrl(`${API_BASE}${endpoint}`);
  const isGas = url.includes('script.google.com');

  const headers: Record<string, string> = {
    'Content-Type': isGas ? 'text/plain;charset=utf-8' : 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (authRequired && !isGas) {
    const token = getSessionToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status}`;
    try {
      const errorBody = await response.json();
      errorDetail = errorBody.detail || errorBody.error || errorDetail;
    } catch {
      // Ignore parse errors
    }
    throw new Error(errorDetail);
  }

  const data = await response.json();
  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error((data as any).error);
  }

  return data as T;
}

// ===== Customer-facing API (no auth) =====

export async function createCustomerOrder(input: CreateOrderInput): Promise<{ success: boolean; order_id: string; message: string }> {
  return request('', {
    method: 'POST',
    body: JSON.stringify(input),
  }, false);
}

// ===== Staff-facing API (auth required) =====

export async function getPendingOrders(truckId?: string): Promise<CustomerOrder[]> {
  const params = truckId ? `?truck_id=${truckId}` : '';
  return request(`/pending${params}`, { method: 'GET' }, true);
}

export async function getAllOrders(status?: string, truckId?: string): Promise<CustomerOrder[]> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (truckId) params.set('truck_id', truckId);
  const query = params.toString() ? `?${params.toString()}` : '';
  return request(`/all${query}`, { method: 'GET' }, true);
}

export async function getOrderDetail(orderId: string): Promise<CustomerOrder> {
  return request(`/${orderId}`, { method: 'GET' }, true);
}

export async function confirmOrder(orderId: string): Promise<{ success: boolean; message: string; order_id: string; print_bill: boolean }> {
  return request(`/${orderId}/confirm`, { method: 'PUT' }, true);
}

export async function updateOrder(
  orderId: string,
  data: { items?: OrderItemInput[]; staff_note?: string; note?: string },
): Promise<{ success: boolean; message: string }> {
  return request(`/${orderId}/update`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }, true);
}

export async function cancelOrder(orderId: string): Promise<{ success: boolean; message: string }> {
  return request(`/${orderId}/cancel`, { method: 'PUT' }, true);
}

export async function completeOrder(orderId: string): Promise<{ success: boolean; message: string }> {
  return request(`/${orderId}/complete`, { method: 'PUT' }, true);
}

// ===== Notifications =====

export async function getUnreadNotifications(): Promise<Notification[]> {
  return request('/notifications/unread', { method: 'GET' }, true);
}

export async function getAllNotifications(): Promise<Notification[]> {
  return request('/notifications/all', { method: 'GET' }, true);
}

export async function markNotificationRead(notifId: string): Promise<{ success: boolean; message: string }> {
  return request(`/notifications/${notifId}/read`, { method: 'PUT' }, true);
}

export async function markAllNotificationsRead(): Promise<{ success: boolean; message: string }> {
  return request('/notifications/read-all', { method: 'PUT' }, true);
}

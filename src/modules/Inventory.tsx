import React, { useState, useEffect } from 'react';
import {
  Package, Plus, Search, X, Check, AlertTriangle, ArrowRightLeft,
  PackagePlus, PackageMinus, Warehouse, Truck as TruckIcon,
  Building2, Phone, MapPin, Utensils, FlaskConical,
} from 'lucide-react';
import { database } from '../database/index.js';
import InventoryItem from '../database/models/InventoryItem.js';
import StockMovement from '../database/models/StockMovement.js';
import BomRecord from '../database/models/BomRecord.js';
import Supplier from '../database/models/Supplier.js';
import TruckModel from '../database/models/Truck.js';
import { formatCurrency, formatDateTime, generateId } from '../shared/utils.js';
import { Modal, Input, Select, TabButton } from '../shared/components.js';

export default function Inventory() {
  const [items, setItems] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [bomRecords, setBomRecords] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [activeSubTab, setActiveSubTab] = useState('items');
  const [showAddItem, setShowAddItem] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const [showSpoilage, setShowSpoilage] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showBom, setShowBom] = useState(false);
  const [showSupplier, setShowSupplier] = useState(false);
  const [showTruck, setShowTruck] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [newItem, setNewItem] = useState({ name: '', unit: 'pcs', qty: '0', price: '0', category: '', isRawMaterial: false, reorderLevel: '10' });
  const [receiveData, setReceiveData] = useState({ itemId: '', qty: '0', note: '', supplierId: '' });
  const [spoilageData, setSpoilageData] = useState({ itemId: '', qty: '0', note: '' });
  const [transferData, setTransferData] = useState({ itemId: '', qty: '0', fromTruck: '', toTruck: '', note: '' });
  const [bomData, setBomData] = useState({ productId: '', productName: '', materialId: '', materialName: '', qty: '1', unit: 'pcs' });
  const [supplierData, setSupplierData] = useState({ name: '', phone: '', address: '', note: '' });
  const [truckData, setTruckData] = useState({ name: '', code: '', status: 'ACTIVE', location: '' });

  useEffect(() => {
    const sub1 = database.get<InventoryItem>('inventory_items').query().observe().subscribe(setItems);
    const sub2 = database.get<StockMovement>('stock_movements').query().observe().subscribe(setMovements);
    const sub3 = database.get<BomRecord>('bom_records').query().observe().subscribe(setBomRecords);
    const sub4 = database.get<Supplier>('suppliers').query().observe().subscribe(setSuppliers);
    const sub5 = database.get<TruckModel>('trucks').query().observe().subscribe(setTrucks);
    return () => { sub1.unsubscribe(); sub2.unsubscribe(); sub3.unsubscribe(); sub4.unsubscribe(); sub5.unsubscribe(); };
  }, []);

  const filteredItems = items.filter((i: any) => !searchTerm || i.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const addItem = async () => {
    await database.write(async () => {
      const item = await database.get<InventoryItem>('inventory_items').create((i: any) => {
        i.name = newItem.name;
        i.sku = 'SKU-' + Date.now();
        i.unit = newItem.unit;
        i.quantity = newItem.qty;
        i.price = newItem.price;
        i.category = newItem.category;
        i.isRawMaterial = newItem.isRawMaterial;
        i.reorderLevel = newItem.reorderLevel;
      });
      if (parseFloat(newItem.qty) > 0) {
        await database.get<StockMovement>('stock_movements').create((m: any) => {
          m._raw.id = generateId();
          m.itemId = item.id;
          m.itemName = newItem.name;
          m.quantity = newItem.qty;
          m.type = 'RECEIVE';
          m.note = 'Nhập kho ban đầu';
          m.createdAt = Date.now();
          m.updatedAt = Date.now();
        });
      }
    });
    setShowAddItem(false);
    setNewItem({ name: '', unit: 'pcs', qty: '0', price: '0', category: '', isRawMaterial: false, reorderLevel: '10' });
  };

  const receiveStock = async () => {
    const now = Date.now();
    await database.write(async () => {
      const item = items.find((i: any) => i.id === receiveData.itemId);
      if (!item) return;
      const newQty = parseFloat(item.quantity) + parseFloat(receiveData.qty);
      await item.update((i: any) => { i.quantity = newQty.toString(); });
      await database.get<StockMovement>('stock_movements').create((m: any) => {
        m._raw.id = generateId();
        m.itemId = item.id;
        m.itemName = item.name;
        m.quantity = receiveData.qty;
        m.type = 'RECEIVE';
        m.note = receiveData.note || 'Nhập kho';
        m.referenceId = receiveData.supplierId || '';
        m.createdAt = now;
        m.updatedAt = now;
      });
    });
    setShowReceive(false);
    setReceiveData({ itemId: '', qty: '0', note: '', supplierId: '' });
  };

  const recordSpoilage = async () => {
    const now = Date.now();
    await database.write(async () => {
      const item = items.find((i: any) => i.id === spoilageData.itemId);
      if (!item) return;
      const newQty = Math.max(0, parseFloat(item.quantity) - parseFloat(spoilageData.qty));
      await item.update((i: any) => { i.quantity = newQty.toString(); });
      await database.get<StockMovement>('stock_movements').create((m: any) => {
        m._raw.id = generateId();
        m.itemId = item.id;
        m.itemName = item.name;
        m.quantity = (-parseFloat(spoilageData.qty)).toString();
        m.type = 'SPOILAGE';
        m.note = spoilageData.note || 'Hàng hỏng/hết hạn';
        m.createdAt = now;
        m.updatedAt = now;
      });
    });
    setShowSpoilage(false);
    setSpoilageData({ itemId: '', qty: '0', note: '' });
  };

  const transferStock = async () => {
    const now = Date.now();
    await database.write(async () => {
      const item = items.find((i: any) => i.id === transferData.itemId);
      if (!item) return;
      const newQty = Math.max(0, parseFloat(item.quantity) - parseFloat(transferData.qty));
      await item.update((i: any) => { i.quantity = newQty.toString(); });
      await database.get<StockMovement>('stock_movements').create((m: any) => {
        m._raw.id = generateId();
        m.itemId = item.id;
        m.itemName = item.name;
        m.quantity = (-parseFloat(transferData.qty)).toString();
        m.type = 'TRANSFER_OUT';
        m.note = transferData.note || `Chuyển đến ${transferData.toTruck}`;
        m.createdAt = now;
        m.updatedAt = now;
      });
    });
    setShowTransfer(false);
    setTransferData({ itemId: '', qty: '0', fromTruck: '', toTruck: '', note: '' });
  };

  const addBom = async () => {
    await database.write(async () => {
      await database.get<BomRecord>('bom_records').create((b: any) => {
        b._raw.id = generateId();
        b.productId = bomData.productId;
        b.productName = bomData.productName;
        b.materialId = bomData.materialId;
        b.materialName = bomData.materialName;
        b.quantity = bomData.qty;
        b.unit = bomData.unit;
        b.createdAt = Date.now();
        b.updatedAt = Date.now();
      });
    });
    setShowBom(false);
    setBomData({ productId: '', productName: '', materialId: '', materialName: '', qty: '1', unit: 'pcs' });
  };

  const addSupplier = async () => {
    await database.write(async () => {
      await database.get<Supplier>('suppliers').create((s: any) => {
        s._raw.id = generateId();
        s.name = supplierData.name;
        s.phone = supplierData.phone;
        s.address = supplierData.address;
        s.note = supplierData.note;
        s.createdAt = Date.now();
        s.updatedAt = Date.now();
      });
    });
    setShowSupplier(false);
    setSupplierData({ name: '', phone: '', address: '', note: '' });
  };

  const addTruck = async () => {
    await database.write(async () => {
      await database.get<TruckModel>('trucks').create((t: any) => {
        t._raw.id = generateId();
        t.name = truckData.name;
        t.code = truckData.code;
        t.status = truckData.status;
        t.location = truckData.location;
        t.createdAt = Date.now();
        t.updatedAt = Date.now();
      });
    });
    setShowTruck(false);
    setTruckData({ name: '', code: '', status: 'ACTIVE', location: '' });
  };

  const tabs = [
    { key: 'items', label: 'Hàng hóa', icon: Package },
    { key: 'movements', label: 'Lịch sử', icon: ArrowRightLeft },
    { key: 'bom', label: 'Công thức', icon: Utensils },
    { key: 'suppliers', label: 'Nhà cung cấp', icon: Building2 },
    { key: 'trucks', label: 'Xe', icon: TruckIcon },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex space-x-2">
          {tabs.map(tab => (
            <TabButton key={tab.key} label={tab.label} active={activeSubTab === tab.key} onClick={() => setActiveSubTab(tab.key)} />
          ))}
        </div>
        <div className="flex space-x-2">
          {activeSubTab === 'items' && (
            <>
              <button onClick={() => setShowReceive(true)} className="px-4 py-2 bg-success-zen text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-all flex items-center space-x-1">
                <PackagePlus size={16} /><span>Nhập kho</span>
              </button>
              <button onClick={() => setShowSpoilage(true)} className="px-4 py-2 bg-error-zen text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-all flex items-center space-x-1">
                <PackageMinus size={16} /><span>Hàng hỏng</span>
              </button>
              <button onClick={() => setShowTransfer(true)} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-all flex items-center space-x-1">
                <ArrowRightLeft size={16} /><span>Chuyển kho</span>
              </button>
              <button onClick={() => setShowAddItem(true)} className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-all flex items-center space-x-1">
                <Plus size={16} /><span>Thêm mới</span>
              </button>
            </>
          )}
          {activeSubTab === 'bom' && (
            <button onClick={() => setShowBom(true)} className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-all flex items-center space-x-1">
              <Plus size={16} /><span>Thêm công thức</span>
            </button>
          )}
          {activeSubTab === 'suppliers' && (
            <button onClick={() => setShowSupplier(true)} className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-all flex items-center space-x-1">
              <Plus size={16} /><span>Thêm NCC</span>
            </button>
          )}
          {activeSubTab === 'trucks' && (
            <button onClick={() => setShowTruck(true)} className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-all flex items-center space-x-1">
              <Plus size={16} /><span>Thêm xe</span>
            </button>
          )}
        </div>
      </div>

      {/* Items Tab */}
      {activeSubTab === 'items' && (
        <div className="space-y-4">
          <div className="relative w-72">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input type="text" placeholder="Tìm kiếm hàng hóa..." value={searchTerm}
              onChange={(e: any) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-surface-zen rounded-lg focus:ring-2 focus:ring-primary/30 outline-none" />
          </div>
          <div className="grid grid-cols-4 gap-4">
            {filteredItems.map((item: any) => (
              <div key={item.id} className="bg-white rounded-xl p-4 shadow-sm border border-surface-zen hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center font-bold">{item.name[0]}</div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${item.isRawMaterial ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    {item.isRawMaterial ? 'Nguyên liệu' : 'Sản phẩm'}
                  </span>
                </div>
                <h4 className="font-semibold text-text-main">{item.name}</h4>
                <p className="text-xs text-text-secondary mt-1">SKU: {item.sku}</p>
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-surface-zen">
                  <div>
                    <p className="text-lg font-bold text-accent">{formatCurrency(parseFloat(item.price || '0'))}</p>
                    <p className="text-xs text-text-secondary">{item.unit}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${parseFloat(item.quantity) <= parseFloat(item.reorderLevel) ? 'text-error-zen' : 'text-success-zen'}`}>
                      {item.quantity}
                    </p>
                    <p className="text-xs text-text-secondary">Tồn kho</p>
                  </div>
                </div>
                {parseFloat(item.quantity) <= parseFloat(item.reorderLevel) && (
                  <div className="mt-2 flex items-center space-x-1 text-xs text-error-zen bg-error-zen/5 p-2 rounded-lg">
                    <AlertTriangle size={12} /><span>Tồn kho thấp (ngưỡng: {item.reorderLevel})</span>
                  </div>
                )}
              </div>
            ))}
            {filteredItems.length === 0 && (
              <div className="col-span-4 text-center py-12 text-gray-400">Chưa có hàng hóa nào</div>
            )}
          </div>
        </div>
      )}

      {/* Movements Tab */}
      {activeSubTab === 'movements' && (
        <div className="bg-white rounded-xl shadow-sm border border-surface-zen overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-zen">
                <tr>
                  <th className="text-left p-4 text-sm font-medium text-text-secondary">Thời gian</th>
                  <th className="text-left p-4 text-sm font-medium text-text-secondary">Hàng hóa</th>
                  <th className="text-left p-4 text-sm font-medium text-text-secondary">Loại</th>
                  <th className="text-right p-4 text-sm font-medium text-text-secondary">Số lượng</th>
                  <th className="text-left p-4 text-sm font-medium text-text-secondary">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {movements.slice().reverse().map((m: any) => (
                  <tr key={m.id} className="border-t border-surface-zen hover:bg-surface-zen/50">
                    <td className="p-4 text-sm">{formatDateTime(m.createdAt)}</td>
                    <td className="p-4 text-sm font-medium">{m.itemName}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        m.type === 'RECEIVE' ? 'bg-green-100 text-green-700' :
                        m.type === 'SALE' ? 'bg-blue-100 text-blue-700' :
                        m.type === 'SPOILAGE' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {m.type === 'RECEIVE' ? 'Nhập' : m.type === 'SALE' ? 'Bán' : m.type === 'SPOILAGE' ? 'Hủy' : 'Chuyển'}
                      </span>
                    </td>
                    <td className={`p-4 text-sm text-right font-bold ${parseFloat(m.quantity) >= 0 ? 'text-success-zen' : 'text-error-zen'}`}>
                      {parseFloat(m.quantity) >= 0 ? '+' : ''}{m.quantity}
                    </td>
                    <td className="p-4 text-sm text-text-secondary">{m.note}</td>
                  </tr>
                ))}
                {movements.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-12 text-gray-400">Chưa có lịch sử xuất nhập</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* BOM Tab */}
      {activeSubTab === 'bom' && (
        <div className="bg-white rounded-xl shadow-sm border border-surface-zen overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-zen">
                <tr>
                  <th className="text-left p-4 text-sm font-medium text-text-secondary">Sản phẩm</th>
                  <th className="text-left p-4 text-sm font-medium text-text-secondary">Nguyên liệu</th>
                  <th className="text-right p-4 text-sm font-medium text-text-secondary">Số lượng</th>
                  <th className="text-left p-4 text-sm font-medium text-text-secondary">Đơn vị</th>
                </tr>
              </thead>
              <tbody>
                {bomRecords.map((b: any) => (
                  <tr key={b.id} className="border-t border-surface-zen hover:bg-surface-zen/50">
                    <td className="p-4 text-sm font-medium">{b.productName}</td>
                    <td className="p-4 text-sm">{b.materialName}</td>
                    <td className="p-4 text-sm text-right font-bold">{b.quantity}</td>
                    <td className="p-4 text-sm text-text-secondary">{b.unit}</td>
                  </tr>
                ))}
                {bomRecords.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-12 text-gray-400">Chưa có công thức chế biến</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Suppliers Tab */}
      {activeSubTab === 'suppliers' && (
        <div className="grid grid-cols-3 gap-4">
          {suppliers.map((s: any) => (
            <div key={s.id} className="bg-white rounded-xl p-4 shadow-sm border border-surface-zen">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center"><Building2 size={20} /></div>
                <div><h4 className="font-semibold">{s.name}</h4></div>
              </div>
              <div className="space-y-1 text-sm text-text-secondary">
                <p className="flex items-center space-x-1"><Phone size={14} /><span>{s.phone}</span></p>
                <p className="flex items-center space-x-1"><MapPin size={14} /><span>{s.address}</span></p>
                {s.note && <p className="text-xs mt-2">{s.note}</p>}
              </div>
            </div>
          ))}
          {suppliers.length === 0 && <div className="col-span-3 text-center py-12 text-gray-400">Chưa có nhà cung cấp</div>}
        </div>
      )}

      {/* Trucks Tab */}
      {activeSubTab === 'trucks' && (
        <div className="grid grid-cols-3 gap-4">
          {trucks.map((t: any) => (
            <div key={t.id} className="bg-white rounded-xl p-4 shadow-sm border border-surface-zen">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center"><TruckIcon size={20} /></div>
                <div>
                  <h4 className="font-semibold">{t.name}</h4>
                  <p className="text-xs text-text-secondary">{t.code}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  t.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                  t.status === 'INACTIVE' ? 'bg-gray-100 text-gray-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {t.status === 'ACTIVE' ? 'Hoạt động' : t.status === 'INACTIVE' ? 'Ngừng' : 'Bảo trì'}
                </span>
                <span className="text-text-secondary">{t.location}</span>
              </div>
            </div>
          ))}
          {trucks.length === 0 && <div className="col-span-3 text-center py-12 text-gray-400">Chưa có xe nào</div>}
        </div>
      )}

      {/* Modals */}
      {showAddItem && (
        <Modal title="Thêm hàng hóa mới" onClose={() => setShowAddItem(false)}>
          <div className="space-y-3">
            <Input label="Tên hàng" value={newItem.name} onChange={(e: any) => setNewItem({ ...newItem, name: e.target.value })} placeholder="Nhập tên hàng hóa" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Đơn vị" value={newItem.unit} onChange={(e: any) => setNewItem({ ...newItem, unit: e.target.value })} placeholder="pcs, kg, lít..." />
              <Input label="Giá bán" type="number" value={newItem.price} onChange={(e: any) => setNewItem({ ...newItem, price: e.target.value })} placeholder="0" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Số lượng đầu" type="number" value={newItem.qty} onChange={(e: any) => setNewItem({ ...newItem, qty: e.target.value })} placeholder="0" />
              <Input label="Ngưỡng tồn tối thiểu" type="number" value={newItem.reorderLevel} onChange={(e: any) => setNewItem({ ...newItem, reorderLevel: e.target.value })} placeholder="10" />
            </div>
            <Input label="Danh mục" value={newItem.category} onChange={(e: any) => setNewItem({ ...newItem, category: e.target.value })} placeholder="VD: Đồ uống, Thức ăn..." />
            <label className="flex items-center space-x-2">
              <input type="checkbox" checked={newItem.isRawMaterial} onChange={(e: any) => setNewItem({ ...newItem, isRawMaterial: e.target.checked })} className="rounded" />
              <span className="text-sm text-text-secondary">Đây là nguyên liệu (không phải sản phẩm bán)</span>
            </label>
            <button onClick={addItem} disabled={!newItem.name} className="w-full py-3 bg-accent text-white rounded-xl font-medium hover:bg-primary-dark transition-all disabled:opacity-50">
              Thêm hàng hóa
            </button>
          </div>
        </Modal>
      )}

      {showReceive && (
        <Modal title="Nhập kho" onClose={() => setShowReceive(false)}>
          <div className="space-y-3">
            <Select label="Chọn hàng hóa" value={receiveData.itemId} onChange={(e: any) => setReceiveData({ ...receiveData, itemId: e.target.value })}
              options={[{ value: '', label: '-- Chọn --' }, ...items.map((i: any) => ({ value: i.id, label: `${i.name} (Tồn: ${i.quantity})` }))]} />
            <Input label="Số lượng nhập" type="number" value={receiveData.qty} onChange={(e: any) => setReceiveData({ ...receiveData, qty: e.target.value })} placeholder="0" />
            <Select label="Nhà cung cấp" value={receiveData.supplierId} onChange={(e: any) => setReceiveData({ ...receiveData, supplierId: e.target.value })}
              options={[{ value: '', label: '-- Không chọn --' }, ...suppliers.map((s: any) => ({ value: s.id, label: s.name }))]} />
            <Input label="Ghi chú" value={receiveData.note} onChange={(e: any) => setReceiveData({ ...receiveData, note: e.target.value })} placeholder="Ghi chú nhập kho..." />
            <button onClick={receiveStock} disabled={!receiveData.itemId || !receiveData.qty} className="w-full py-3 bg-success-zen text-white rounded-xl font-medium hover:bg-green-700 transition-all disabled:opacity-50">
              Xác nhận nhập kho
            </button>
          </div>
        </Modal>
      )}

      {showSpoilage && (
        <Modal title="Hàng hỏng / Hủy" onClose={() => setShowSpoilage(false)}>
          <div className="space-y-3">
            <Select label="Chọn hàng hóa" value={spoilageData.itemId} onChange={(e: any) => setSpoilageData({ ...spoilageData, itemId: e.target.value })}
              options={[{ value: '', label: '-- Chọn --' }, ...items.map((i: any) => ({ value: i.id, label: `${i.name} (Tồn: ${i.quantity})` }))]} />
            <Input label="Số lượng hủy" type="number" value={spoilageData.qty} onChange={(e: any) => setSpoilageData({ ...spoilageData, qty: e.target.value })} placeholder="0" />
            <Input label="Lý do" value={spoilageData.note} onChange={(e: any) => setSpoilageData({ ...spoilageData, note: e.target.value })} placeholder="Hàng hết hạn, hỏng..." />
            <button onClick={recordSpoilage} disabled={!spoilageData.itemId || !spoilageData.qty} className="w-full py-3 bg-error-zen text-white rounded-xl font-medium hover:bg-red-700 transition-all disabled:opacity-50">
              Xác nhận hủy
            </button>
          </div>
        </Modal>
      )}

      {showTransfer && (
        <Modal title="Chuyển kho" onClose={() => setShowTransfer(false)}>
          <div className="space-y-3">
            <Select label="Chọn hàng hóa" value={transferData.itemId} onChange={(e: any) => setTransferData({ ...transferData, itemId: e.target.value })}
              options={[{ value: '', label: '-- Chọn --' }, ...items.map((i: any) => ({ value: i.id, label: `${i.name} (Tồn: ${i.quantity})` }))]} />
            <Input label="Số lượng chuyển" type="number" value={transferData.qty} onChange={(e: any) => setTransferData({ ...transferData, qty: e.target.value })} placeholder="0" />
            <Input label="Xe nhận" value={transferData.toTruck} onChange={(e: any) => setTransferData({ ...transferData, toTruck: e.target.value })} placeholder="Tên xe nhận..." />
            <Input label="Ghi chú" value={transferData.note} onChange={(e: any) => setTransferData({ ...transferData, note: e.target.value })} placeholder="Ghi chú chuyển kho..." />
            <button onClick={transferStock} disabled={!transferData.itemId || !transferData.qty} className="w-full py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark transition-all disabled:opacity-50">
              Xác nhận chuyển kho
            </button>
          </div>
        </Modal>
      )}

      {showBom && (
        <Modal title="Thêm công thức chế biến" onClose={() => setShowBom(false)}>
          <div className="space-y-3">
            <Select label="Sản phẩm" value={bomData.productId} onChange={(e: any) => {
              const p = items.find((i: any) => i.id === e.target.value);
              setBomData({ ...bomData, productId: e.target.value, productName: p?.name || '' });
            }} options={[{ value: '', label: '-- Chọn sản phẩm --' }, ...items.filter((i: any) => !i.isRawMaterial).map((i: any) => ({ value: i.id, label: i.name }))]} />
            <Select label="Nguyên liệu" value={bomData.materialId} onChange={(e: any) => {
              const m = items.find((i: any) => i.id === e.target.value);
              setBomData({ ...bomData, materialId: e.target.value, materialName: m?.name || '' });
            }} options={[{ value: '', label: '-- Chọn nguyên liệu --' }, ...items.filter((i: any) => i.isRawMaterial).map((i: any) => ({ value: i.id, label: i.name }))]} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Số lượng" type="number" value={bomData.qty} onChange={(e: any) => setBomData({ ...bomData, qty: e.target.value })} placeholder="1" />
              <Input label="Đơn vị" value={bomData.unit} onChange={(e: any) => setBomData({ ...bomData, unit: e.target.value })} placeholder="pcs, kg..." />
            </div>
            <button onClick={addBom} disabled={!bomData.productId || !bomData.materialId} className="w-full py-3 bg-accent text-white rounded-xl font-medium hover:bg-primary-dark transition-all disabled:opacity-50">
              Thêm công thức
            </button>
          </div>
        </Modal>
      )}

      {showSupplier && (
        <Modal title="Thêm nhà cung cấp" onClose={() => setShowSupplier(false)}>
          <div className="space-y-3">
            <Input label="Tên nhà cung cấp" value={supplierData.name} onChange={(e: any) => setSupplierData({ ...supplierData, name: e.target.value })} placeholder="Nhập tên..." />
            <Input label="Số điện thoại" value={supplierData.phone} onChange={(e: any) => setSupplierData({ ...supplierData, phone: e.target.value })} placeholder="Số điện thoại..." />
            <Input label="Địa chỉ" value={supplierData.address} onChange={(e: any) => setSupplierData({ ...supplierData, address: e.target.value })} placeholder="Địa chỉ..." />
            <Input label="Ghi chú" value={supplierData.note} onChange={(e: any) => setSupplierData({ ...supplierData, note: e.target.value })} placeholder="Ghi chú..." />
            <button onClick={addSupplier} disabled={!supplierData.name} className="w-full py-3 bg-accent text-white rounded-xl font-medium hover:bg-primary-dark transition-all disabled:opacity-50">
              Thêm nhà cung cấp
            </button>
          </div>
        </Modal>
      )}

      {showTruck && (
        <Modal title="Thêm xe" onClose={() => setShowTruck(false)}>
          <div className="space-y-3">
            <Input label="Tên xe" value={truckData.name} onChange={(e: any) => setTruckData({ ...truckData, name: e.target.value })} placeholder="VD: Xe 01" />
            <Input label="Mã xe" value={truckData.code} onChange={(e: any) => setTruckData({ ...truckData, code: e.target.value })} placeholder="VD: XE-001" />
            <Select label="Trạng thái" value={truckData.status} onChange={(e: any) => setTruckData({ ...truckData, status: e.target.value })}
              options={[
                { value: 'ACTIVE', label: 'Hoạt động' },
                { value: 'INACTIVE', label: 'Ngừng hoạt động' },
                { value: 'MAINTENANCE', label: 'Bảo trì' },
              ]} />
            <Input label="Vị trí" value={truckData.location} onChange={(e: any) => setTruckData({ ...truckData, location: e.target.value })} placeholder="Vị trí..." />
            <button onClick={addTruck} disabled={!truckData.name} className="w-full py-3 bg-accent text-white rounded-xl font-medium hover:bg-primary-dark transition-all disabled:opacity-50">
              Thêm xe
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

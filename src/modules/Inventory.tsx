import React, { useState, useEffect } from 'react';
import {
  Package, Plus, Search, X, Check, AlertTriangle, ArrowRightLeft,
  PackagePlus, PackageMinus, Warehouse, Truck as TruckIcon,
  Building2, Phone, MapPin, Utensils, FlaskConical,
  Store, ArrowRight, ArrowLeft,
} from 'lucide-react';
import { database } from '../database/index.js';
import InventoryItem from '../database/models/InventoryItem.js';
import StockMovement from '../database/models/StockMovement.js';
import BomRecord from '../database/models/BomRecord.js';
import Supplier from '../database/models/Supplier.js';
import TruckModel from '../database/models/Truck.js';
import { receiveInventory, issueInventory, countInventory, adjustInventory } from '../database/inventoryApi.js';
import { formatCurrency, formatDateTime, generateId } from '../shared/utils.js';
import { Modal, Input, Select, TabButton } from '../shared/components.js';
import { useToast } from '../shared/ToastContext.js';

export default function Inventory() {
  const toast = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [bomRecords, setBomRecords] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [activeSubTab, setActiveSubTab] = useState('warehouse');
  const [showAddItem, setShowAddItem] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const [showSpoilage, setShowSpoilage] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showCount, setShowCount] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [showBom, setShowBom] = useState(false);
  const [showSupplier, setShowSupplier] = useState(false);
  const [showTruck, setShowTruck] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTruck, setSelectedTruck] = useState('all');

  const [newItem, setNewItem] = useState({ name: '', unit: 'pcs', qty: '0', price: '0', category: '', isRawMaterial: false, reorderLevel: '10', locationType: 'MAIN_WAREHOUSE', truckId: '' });
  const [receiveData, setReceiveData] = useState({ itemId: '', qty: '0', note: '', supplierId: '' });
  const [spoilageData, setSpoilageData] = useState({ itemId: '', qty: '0', note: '' });
  const [transferData, setTransferData] = useState({ itemId: '', qty: '0', fromLocation: 'MAIN_WAREHOUSE', toTruck: '', note: '' });
  const [countData, setCountData] = useState({ itemId: '', countedQty: '0', note: '' });
  const [adjustData, setAdjustData] = useState({ itemId: '', deltaQty: '0', note: '' });
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

  const warehouseItems = items.filter((i: any) => i.locationType === 'MAIN_WAREHOUSE' || !i.locationType);
  const truckItems = items.filter((i: any) => i.locationType === 'TRUCK');

  const filteredWarehouseItems = warehouseItems.filter((i: any) => !searchTerm || i.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredTruckItems = selectedTruck === 'all'
    ? truckItems.filter((i: any) => !searchTerm || i.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : truckItems.filter((i: any) => (i.truckId === selectedTruck) && (!searchTerm || i.name.toLowerCase().includes(searchTerm.toLowerCase())));

  const addItem = async () => {
    if (!newItem.name.trim()) {
      toast.error('Tên hàng hóa là bắt buộc!');
      return;
    }
    if (newItem.locationType === 'TRUCK' && !newItem.truckId) {
      toast.error('Vui lòng chọn xe nhận khi lưu vào Kho xe!');
      return;
    }
    const parsedQty = parseFloat(newItem.qty);
    if (isNaN(parsedQty) || parsedQty < 0) {
      toast.error('Số lượng ban đầu không hợp lệ (không thể nhỏ hơn 0)!');
      return;
    }
    const parsedPrice = parseFloat(newItem.price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      toast.error('Giá bán không hợp lệ (không thể nhỏ hơn 0)!');
      return;
    }
    const parsedReorder = parseFloat(newItem.reorderLevel);
    if (isNaN(parsedReorder) || parsedReorder < 0) {
      toast.error('Ngưỡng tồn tối thiểu không hợp lệ (không thể nhỏ hơn 0)!');
      return;
    }

    const sku = 'SKU-' + Date.now();
    const shouldSyncInitialStock = parsedQty > 0;
    const initialStockLocation = newItem.locationType === 'TRUCK' ? newItem.truckId : 'MAIN_WAREHOUSE';
    
    try {
      await database.write(async () => {
        const item = await database.get<InventoryItem>('inventory_items').create((i: any) => {
          i.name = newItem.name.trim();
          i.sku = sku;
          i.unit = newItem.unit.trim() || 'cái';
          i.quantity = newItem.qty;
          i.price = newItem.price;
          i.category = newItem.category.trim();
          i.isRawMaterial = newItem.isRawMaterial;
          i.reorderLevel = newItem.reorderLevel;
          i.locationType = newItem.locationType;
          i.truckId = newItem.locationType === 'TRUCK' ? newItem.truckId : '';
        });
        if (parsedQty > 0) {
          await database.get<StockMovement>('stock_movements').create((m: any) => {
            m._raw.id = generateId();
            m.itemId = item.id;
            m.itemName = newItem.name.trim();
            m.quantity = newItem.qty;
            m.type = 'RECEIVE';
            m.note = `Nhập kho ${newItem.locationType === 'TRUCK' ? 'xe' : 'tổng'} ban đầu`;
          });
        }
      });

      if (shouldSyncInitialStock) {
        receiveInventory(
          [{ product_id: sku, quantity: newItem.qty }],
          initialStockLocation,
          'initial-stock',
          `Nhập kho ${newItem.locationType === 'TRUCK' ? 'xe' : 'tổng'} ban đầu`,
        ).catch((error) => console.warn('Inventory sync failed:', error.message));
      }

      setShowAddItem(false);
      const addedName = newItem.name;
      setNewItem({ name: '', unit: 'pcs', qty: '0', price: '0', category: '', isRawMaterial: false, reorderLevel: '10', locationType: 'MAIN_WAREHOUSE', truckId: '' });
      toast.success(`Đã thêm thành công hàng hóa "${addedName}"!`);
    } catch (err: any) {
      toast.error(`Lỗi tạo hàng hóa: ${err.message || 'Không thể thực hiện'}`);
    }
  };

  const receiveStock = async () => {
    if (!receiveData.itemId) {
      toast.error('Vui lòng chọn hàng hóa cần nhập kho!');
      return;
    }
    const parsedQty = parseFloat(receiveData.qty);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      toast.error('Số lượng nhập phải lớn hơn 0!');
      return;
    }

    const item = items.find((i: any) => i.id === receiveData.itemId);
    if (!item) {
      toast.error('Không tìm thấy hàng hóa đã chọn!');
      return;
    }

    const now = Date.now();
    try {
      await database.write(async () => {
        const newQty = parseFloat(item.quantity) + parsedQty;
        await item.update((i: any) => { i.quantity = newQty.toString(); });
        await database.get<StockMovement>('stock_movements').create((m: any) => {
          m._raw.id = generateId();
          m.itemId = item.id;
          m.itemName = item.name;
          m.quantity = receiveData.qty;
          m.type = 'RECEIVE';
          m.note = receiveData.note.trim() || 'Nhập kho';
          m.referenceId = receiveData.supplierId || '';
        });
      });

      receiveInventory(
        [{ product_id: item.sku || receiveData.itemId, quantity: receiveData.qty }],
        item.locationType === 'TRUCK' ? item.truckId : 'MAIN_WAREHOUSE',
        receiveData.supplierId || undefined,
        receiveData.note.trim() || 'Nhập kho',
      ).catch((error) => console.warn('Inventory sync failed:', error.message));

      setShowReceive(false);
      setReceiveData({ itemId: '', qty: '0', note: '', supplierId: '' });
      toast.success(`Đã nhập kho ${receiveData.qty} ${item.unit || ''} "${item.name}"`);
    } catch (err: any) {
      toast.error(`Lỗi nhập kho: ${err.message || 'Không thể thực hiện'}`);
    }
  };

  const recordSpoilage = async () => {
    if (!spoilageData.itemId) {
      toast.error('Vui lòng chọn hàng hóa cần báo hỏng!');
      return;
    }
    const parsedQty = parseFloat(spoilageData.qty);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      toast.error('Số lượng hủy phải lớn hơn 0!');
      return;
    }

    const item = items.find((i: any) => i.id === spoilageData.itemId);
    if (!item) {
      toast.error('Không tìm thấy hàng hóa đã chọn!');
      return;
    }

    if (parsedQty > parseFloat(item.quantity)) {
      toast.error(`Số lượng báo hỏng (${parsedQty}) vượt quá tồn kho hiện tại (${item.quantity})!`);
      return;
    }

    const now = Date.now();
    try {
      await database.write(async () => {
        const newQty = Math.max(0, parseFloat(item.quantity) - parsedQty);
        await item.update((i: any) => { i.quantity = newQty.toString(); });
        await database.get<StockMovement>('stock_movements').create((m: any) => {
          m._raw.id = generateId();
          m.itemId = item.id;
          m.itemName = item.name;
          m.quantity = (-parsedQty).toString();
          m.type = 'SPOILAGE';
          m.note = spoilageData.note.trim() || 'Hàng hỏng/hết hạn';
        });
      });

      issueInventory(
        [{ product_id: item.sku || spoilageData.itemId, quantity: spoilageData.qty }],
        item.locationType === 'TRUCK' ? item.truckId : 'MAIN_WAREHOUSE',
        'spoilage',
        spoilageData.note.trim() || 'Hàng hỏng/hết hạn',
      ).catch((error) => console.warn('Inventory sync failed:', error.message));

      setShowSpoilage(false);
      setSpoilageData({ itemId: '', qty: '0', note: '' });
      toast.warning(`Đã ghi nhận hủy ${parsedQty} "${item.name}" do hỏng/hết hạn!`);
    } catch (err: any) {
      toast.error(`Lỗi ghi nhận hàng hỏng: ${err.message || 'Không thể thực hiện'}`);
    }
  };

  const transferToTruck = async () => {
    if (!transferData.itemId) {
      toast.error('Vui lòng chọn hàng hóa cần xuất cho xe!');
      return;
    }
    if (!transferData.toTruck) {
      toast.error('Vui lòng chọn xe nhận hàng!');
      return;
    }
    const parsedQty = parseFloat(transferData.qty);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      toast.error('Số lượng xuất chuyển phải lớn hơn 0!');
      return;
    }

    const sourceItem = items.find((i: any) => i.id === transferData.itemId);
    if (!sourceItem) {
      toast.error('Không tìm thấy hàng hóa trong kho tổng!');
      return;
    }

    if (parsedQty > parseFloat(sourceItem.quantity)) {
      toast.error(`Số lượng xuất (${parsedQty}) vượt quá tồn kho hiện tại (${sourceItem.quantity})!`);
      return;
    }

    const now = Date.now();
    try {
      await database.write(async () => {
        const newSourceQty = Math.max(0, parseFloat(sourceItem.quantity) - parsedQty);
        await sourceItem.update((i: any) => { i.quantity = newSourceQty.toString(); });

        const truckItem = items.find((i: any) =>
          i.name === sourceItem.name &&
          i.locationType === 'TRUCK' &&
          i.truckId === transferData.toTruck
        );

        if (truckItem) {
          const newTruckQty = parseFloat(truckItem.quantity) + parsedQty;
          await truckItem.update((i: any) => { i.quantity = newTruckQty.toString(); });
        } else {
          await database.get<InventoryItem>('inventory_items').create((i: any) => {
            i._raw.id = generateId();
            i.name = sourceItem.name;
            i.sku = sourceItem.sku + '-TRUCK';
            i.unit = sourceItem.unit;
            i.quantity = transferData.qty;
            i.price = sourceItem.price;
            i.category = sourceItem.category;
            i.isRawMaterial = sourceItem.isRawMaterial;
            i.reorderLevel = sourceItem.reorderLevel;
            i.locationType = 'TRUCK';
            i.truckId = transferData.toTruck;
          });
        }

        await database.get<StockMovement>('stock_movements').create((m: any) => {
          m._raw.id = generateId();
          m.itemId = sourceItem.id;
          m.itemName = sourceItem.name;
          m.quantity = (-parsedQty).toString();
          m.type = 'TRANSFER_OUT';
          m.referenceId = transferData.toTruck;
          m.note = transferData.note.trim() || `Xuất kho tổng → xe ${transferData.toTruck}`;
        });

        await database.get<StockMovement>('stock_movements').create((m: any) => {
          m._raw.id = generateId();
          m.itemId = sourceItem.id;
          m.itemName = sourceItem.name;
          m.quantity = transferData.qty;
          m.type = 'TRANSFER_IN';
          m.referenceId = transferData.toTruck;
          m.note = `Nhập kho xe ${transferData.toTruck} từ kho tổng`;
        });
      });

      issueInventory(
        [{ product_id: sourceItem.sku, quantity: transferData.qty }],
        'MAIN_WAREHOUSE',
        transferData.toTruck || undefined,
        transferData.note.trim() || `Xuất kho tổng → xe ${transferData.toTruck}`,
      ).catch((error) => console.warn('Inventory sync failed:', error.message));
      
      receiveInventory(
        [{ product_id: sourceItem.sku, quantity: transferData.qty }],
        transferData.toTruck || undefined,
        transferData.toTruck || undefined,
        `Nhập kho xe ${transferData.toTruck} từ kho tổng`,
      ).catch((error) => console.warn('Inventory sync failed:', error.message));

      setShowTransfer(false);
      setTransferData({ itemId: '', qty: '0', fromLocation: 'MAIN_WAREHOUSE', toTruck: '', note: '' });
      toast.success(`Đã chuyển thành công ${parsedQty} hàng từ kho tổng sang xe!`);
    } catch (err: any) {
      toast.error(`Lỗi chuyển kho: ${err.message || 'Không thể thực hiện'}`);
    }
  };

  const countStock = async () => {
    if (!countData.itemId) {
      toast.error('Vui lòng chọn hàng hóa cần kiểm kê!');
      return;
    }
    const parsedQty = parseFloat(countData.countedQty);
    if (isNaN(parsedQty) || parsedQty < 0) {
      toast.error('Số lượng kiểm kê thực tế không thể nhỏ hơn 0!');
      return;
    }

    const item = items.find((entry: any) => entry.id === countData.itemId);
    if (!item) {
      toast.error('Không tìm thấy hàng hóa đã chọn!');
      return;
    }

    const now = Date.now();
    try {
      await database.write(async () => {
        await item.update((i: any) => { i.quantity = String(parsedQty); });
        await database.get<StockMovement>('stock_movements').create((m: any) => {
          m._raw.id = generateId();
          m.itemId = item.id;
          m.itemName = item.name;
          m.quantity = String(parsedQty - parseFloat(item.quantity));
          m.type = 'ADJUSTMENT';
          m.note = countData.note.trim() || 'Kiểm kê';
        });
      });

      countInventory(
        [{ product_id: item.sku, counted_quantity: countData.countedQty }],
        item.locationType === 'TRUCK' ? item.truckId : 'MAIN_WAREHOUSE',
        'count',
        countData.note.trim() || 'Kiểm kê',
      ).catch((error) => console.warn('Inventory sync failed:', error.message));

      setShowCount(false);
      setCountData({ itemId: '', countedQty: '0', note: '' });
      toast.success(`Đã kiểm kê và cập nhật thành công tồn kho "${item.name}"!`);
    } catch (err: any) {
      toast.error(`Lỗi kiểm kê: ${err.message || 'Không thể thực hiện'}`);
    }
  };

  const adjustStock = async () => {
    if (!adjustData.itemId) {
      toast.error('Vui lòng chọn hàng hóa cần điều chỉnh!');
      return;
    }
    const delta = parseFloat(adjustData.deltaQty);
    if (isNaN(delta) || delta === 0) {
      toast.error('Chênh lệch điều chỉnh phải khác 0!');
      return;
    }

    const item = items.find((entry: any) => entry.id === adjustData.itemId);
    if (!item) {
      toast.error('Không tìm thấy hàng hóa đã chọn!');
      return;
    }

    const newQty = parseFloat(item.quantity) + delta;
    if (newQty < 0) {
      toast.error(`Số lượng sau điều chỉnh không thể âm (Tồn: ${item.quantity}, chỉnh: ${delta})!`);
      return;
    }

    const now = Date.now();
    try {
      await database.write(async () => {
        await item.update((i: any) => { i.quantity = newQty.toString(); });
        await database.get<StockMovement>('stock_movements').create((m: any) => {
          m._raw.id = generateId();
          m.itemId = item.id;
          m.itemName = item.name;
          m.quantity = adjustData.deltaQty;
          m.type = 'ADJUSTMENT';
          m.note = adjustData.note.trim() || 'Điều chỉnh tồn kho';
        });
      });

      adjustInventory(
        [{ product_id: item.sku, delta_quantity: adjustData.deltaQty }],
        item.locationType === 'TRUCK' ? item.truckId : 'MAIN_WAREHOUSE',
        'adjust',
        adjustData.note.trim() || 'Điều chỉnh tồn kho',
      ).catch((error) => console.warn('Inventory sync failed:', error.message));

      setShowAdjust(false);
      setAdjustData({ itemId: '', deltaQty: '0', note: '' });
      toast.success(`Đã điều chỉnh thành công tồn kho "${item.name}"!`);
    } catch (err: any) {
      toast.error(`Lỗi điều chỉnh tồn kho: ${err.message || 'Không thể thực hiện'}`);
    }
  };

  const addBom = async () => {
    if (!bomData.productName.trim() || !bomData.productId.trim()) {
      toast.error('Vui lòng nhập tên và mã sản phẩm (thông tin bắt buộc)!');
      return;
    }
    if (!bomData.materialName.trim() || !bomData.materialId.trim()) {
      toast.error('Vui lòng nhập tên và mã nguyên liệu (thông tin bắt buộc)!');
      return;
    }
    const qtyParsed = parseFloat(bomData.qty);
    if (isNaN(qtyParsed) || qtyParsed <= 0) {
      toast.error('Số lượng định mức phải lớn hơn 0!');
      return;
    }

    try {
      await database.write(async () => {
        await database.get<BomRecord>('bom_records').create((b: any) => {
          b._raw.id = generateId();
          b.productId = bomData.productId.trim();
          b.productName = bomData.productName.trim();
          b.materialId = bomData.materialId.trim();
          b.materialName = bomData.materialName.trim();
          b.quantity = bomData.qty;
          b.unit = bomData.unit.trim() || 'pcs';
        });
      });
      setShowBom(false);
      const prodName = bomData.productName;
      setBomData({ productId: '', productName: '', materialId: '', materialName: '', qty: '1', unit: 'pcs' });
      toast.success(`Đã thêm công thức thành công cho "${prodName}"!`);
    } catch (err: any) {
      toast.error(`Lỗi lưu công thức: ${err.message || 'Không thể thực hiện'}`);
    }
  };

  const addSupplier = async () => {
    if (!supplierData.name.trim()) {
      toast.error('Tên nhà cung cấp là bắt buộc!');
      return;
    }
    if (!supplierData.phone.trim()) {
      toast.error('Số điện thoại liên hệ là bắt buộc!');
      return;
    }

    try {
      await database.write(async () => {
        await database.get<Supplier>('suppliers').create((s: any) => {
          s._raw.id = generateId();
          s.name = supplierData.name.trim();
          s.phone = supplierData.phone.trim();
          s.address = supplierData.address.trim();
          s.note = supplierData.note.trim();
        });
      });
      setShowSupplier(false);
      const supName = supplierData.name;
      setSupplierData({ name: '', phone: '', address: '', note: '' });
      toast.success(`Đã thêm thành công nhà cung cấp "${supName}"!`);
    } catch (err: any) {
      toast.error(`Lỗi thêm nhà cung cấp: ${err.message || 'Không thể thực hiện'}`);
    }
  };

  const addTruck = async () => {
    if (!truckData.name.trim() || !truckData.code.trim()) {
      toast.error('Tên xe và mã hiệu xe là bắt buộc!');
      return;
    }

    try {
      await database.write(async () => {
        await database.get<TruckModel>('trucks').create((t: any) => {
          t._raw.id = generateId();
          t.name = truckData.name.trim();
          t.code = truckData.code.trim().toUpperCase();
          t.status = truckData.status;
          t.location = truckData.location.trim();
        });
      });
      setShowTruck(false);
      const trkName = truckData.name;
      setTruckData({ name: '', code: '', status: 'ACTIVE', location: '' });
      toast.success(`Đã thêm thành công xe lưu động "${trkName}"!`);
    } catch (err: any) {
      toast.error(`Lỗi thêm thông tin xe: ${err.message || 'Không thể thực hiện'}`);
    }
  };

  const tabs = [
    { key: 'warehouse', label: 'Kho tổng', icon: Warehouse },
    { key: 'truck_inventory', label: 'Kho xe', icon: TruckIcon },
    { key: 'movements', label: 'Lịch sử', icon: ArrowRightLeft },
    { key: 'bom', label: 'Công thức', icon: Utensils },
    { key: 'suppliers', label: 'Nhà cung cấp', icon: Building2 },
    { key: 'trucks', label: 'Xe', icon: TruckIcon },
  ];

  const renderItemCard = (item: any, showLocation = false) => (
    <div key={item.id} className="bg-white rounded-xl p-4 shadow-sm border border-surface-zen hover:shadow-md transition-all">
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center font-bold">{item.name[0]}</div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${item.isRawMaterial ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
          {item.isRawMaterial ? 'Nguyên liệu' : 'Sản phẩm'}
        </span>
      </div>
      <h4 className="font-semibold text-text-main">{item.name}</h4>
      <p className="text-xs text-text-secondary mt-1">SKU: {item.sku}</p>
      {showLocation && item.locationType === 'TRUCK' && (
        <p className="text-xs text-primary mt-1">
          <TruckIcon size={12} className="inline mr-1" />
          {trucks.find((t: any) => t.id === item.truckId)?.name || item.truckId || 'Xe không xác định'}
        </p>
      )}
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
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex space-x-2 flex-wrap gap-2">
          {tabs.map(tab => (
            <TabButton key={tab.key} label={tab.label} active={activeSubTab === tab.key} onClick={() => setActiveSubTab(tab.key)} />
          ))}
        </div>
        <div className="flex space-x-2">
          {(activeSubTab === 'warehouse' || activeSubTab === 'truck_inventory') && (
            <>
              <button onClick={() => setShowReceive(true)} className="px-4 py-2 bg-success-zen text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-all flex items-center space-x-1">
                <PackagePlus size={16} /><span>Nhập kho</span>
              </button>
              <button onClick={() => setShowCount(true)} className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 transition-all flex items-center space-x-1">
                <Check size={16} /><span>Kiểm kê</span>
              </button>
              <button onClick={() => setShowAdjust(true)} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-all flex items-center space-x-1">
                <ArrowRight size={16} /><span>Điều chỉnh</span>
              </button>
              <button onClick={() => setShowSpoilage(true)} className="px-4 py-2 bg-error-zen text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-all flex items-center space-x-1">
                <PackageMinus size={16} /><span>Hàng hỏng</span>
              </button>
              {activeSubTab === 'warehouse' && (
                <button onClick={() => setShowTransfer(true)} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-all flex items-center space-x-1">
                  <ArrowRightLeft size={16} /><span>Xuất cho xe</span>
                </button>
              )}
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

      {/* Kho tổng (Main Warehouse) Tab */}
      {activeSubTab === 'warehouse' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative w-72">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input type="text" placeholder="Tìm kiếm hàng hóa..." value={searchTerm}
                onChange={(e: any) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-surface-zen rounded-lg focus:ring-2 focus:ring-primary/30 outline-none" />
            </div>
            <div className="flex items-center space-x-2 text-sm text-text-secondary">
              <Warehouse size={16} />
              <span>Kho tổng: {filteredWarehouseItems.length} mặt hàng</span>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {filteredWarehouseItems.map((item: any) => renderItemCard(item))}
            {filteredWarehouseItems.length === 0 && (
              <div className="col-span-4 text-center py-12 text-gray-400">Chưa có hàng hóa trong kho tổng</div>
            )}
          </div>
        </div>
      )}

      {/* Kho xe (Truck Inventory) Tab */}
      {activeSubTab === 'truck_inventory' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative w-72">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input type="text" placeholder="Tìm kiếm hàng hóa..." value={searchTerm}
                onChange={(e: any) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-surface-zen rounded-lg focus:ring-2 focus:ring-primary/30 outline-none" />
            </div>
            <div className="flex space-x-2">
              <select value={selectedTruck} onChange={(e: any) => setSelectedTruck(e.target.value)}
                className="px-3 py-2 border border-surface-zen rounded-lg text-sm bg-white outline-none">
                <option value="all">Tất cả xe</option>
                {trucks.filter((t: any) => t.status === 'ACTIVE').map((t: any) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                ))}
              </select>
            </div>
          </div>
          {selectedTruck !== 'all' && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center space-x-3">
              <TruckIcon size={24} className="text-primary" />
              <div>
                <p className="font-bold text-primary-dark">{trucks.find((t: any) => t.id === selectedTruck)?.name || 'Xe'}</p>
                <p className="text-sm text-text-secondary">Kho xe: {filteredTruckItems.length} mặt hàng</p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-4 gap-4">
            {filteredTruckItems.map((item: any) => renderItemCard(item, true))}
            {filteredTruckItems.length === 0 && (
              <div className="col-span-4 text-center py-12 text-gray-400">
                {selectedTruck === 'all' ? 'Chưa có hàng hóa trên xe nào' : 'Xe này chưa có hàng hóa'}
              </div>
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
                        m.type === 'TRANSFER_OUT' ? 'bg-yellow-100 text-yellow-700' :
                        m.type === 'TRANSFER_IN' ? 'bg-purple-100 text-purple-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {m.type === 'RECEIVE' ? 'Nhập' : m.type === 'SALE' ? 'Bán' : m.type === 'SPOILAGE' ? 'Hủy' : m.type === 'TRANSFER_OUT' ? 'Xuất xe' : m.type === 'TRANSFER_IN' ? 'Nhập xe' : 'Điều chỉnh'}
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
          {trucks.map((t: any) => {
            const truckItemCount = items.filter((i: any) => i.locationType === 'TRUCK' && i.truckId === t.id).length;
            return (
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
                <div className="mt-2 text-xs text-primary">
                  <Package size={12} className="inline mr-1" />{truckItemCount} mặt hàng trên xe
                </div>
              </div>
            );
          })}
          {trucks.length === 0 && <div className="col-span-3 text-center py-12 text-gray-400">Chưa có xe nào</div>}
        </div>
      )}

      {/* Modal: Add Item */}
      {showAddItem && (
        <Modal title="Thêm hàng hóa mới" onClose={() => setShowAddItem(false)}>
          <div className="space-y-3">
            <Input label={<>Tên hàng <span className="text-red-500 font-bold ml-0.5">*</span></>} value={newItem.name} onChange={(e: any) => setNewItem({ ...newItem, name: e.target.value })} placeholder="Nhập tên hàng hóa" />
            <div className="grid grid-cols-2 gap-3">
              <Input label={<>Đơn vị <span className="text-red-500 font-bold ml-0.5">*</span></>} value={newItem.unit} onChange={(e: any) => setNewItem({ ...newItem, unit: e.target.value })} placeholder="pcs, kg, lít..." />
              <Input label={<>Giá bán <span className="text-red-500 font-bold ml-0.5">*</span></>} type="number" value={newItem.price} onChange={(e: any) => setNewItem({ ...newItem, price: e.target.value })} placeholder="0" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label={<>Số lượng đầu <span className="text-red-500 font-bold ml-0.5">*</span></>} type="number" value={newItem.qty} onChange={(e: any) => setNewItem({ ...newItem, qty: e.target.value })} placeholder="0" />
              <Input label="Ngưỡng tồn tối thiểu" type="number" value={newItem.reorderLevel} onChange={(e: any) => setNewItem({ ...newItem, reorderLevel: e.target.value })} placeholder="10" />
            </div>
            <Input label="Danh mục" value={newItem.category} onChange={(e: any) => setNewItem({ ...newItem, category: e.target.value })} placeholder="VD: Đồ uống, Thức ăn..." />
            <div className="flex space-x-2">
              <button onClick={() => setNewItem({ ...newItem, locationType: 'MAIN_WAREHOUSE', truckId: '' })}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${newItem.locationType === 'MAIN_WAREHOUSE' ? 'bg-primary text-white' : 'bg-surface-zen text-text-secondary'}`}>
                <Warehouse size={16} className="inline mr-1" />Kho tổng
              </button>
              <button onClick={() => setNewItem({ ...newItem, locationType: 'TRUCK' })}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${newItem.locationType === 'TRUCK' ? 'bg-primary text-white' : 'bg-surface-zen text-text-secondary'}`}>
                <TruckIcon size={16} className="inline mr-1" />Kho xe
              </button>
            </div>
            {newItem.locationType === 'TRUCK' && (
              <Select label={<>Chọn xe nhận <span className="text-red-500 font-bold ml-0.5">*</span></>} value={newItem.truckId} onChange={(e: any) => setNewItem({ ...newItem, truckId: e.target.value })}
                options={[{ value: '', label: '-- Chọn xe --' }, ...trucks.filter((t: any) => t.status === 'ACTIVE').map((t: any) => ({ value: t.id, label: `${t.name} (${t.code})` }))]} />
            )}
            <label className="flex items-center space-x-2">
              <input type="checkbox" checked={newItem.isRawMaterial} onChange={(e: any) => setNewItem({ ...newItem, isRawMaterial: e.target.checked })} className="rounded" />
              <span className="text-sm">Đây là nguyên liệu thô</span>
            </label>
            <div className="flex justify-end space-x-2 pt-2">
              <button onClick={() => setShowAddItem(false)} className="px-4 py-2 bg-surface-zen text-text-secondary rounded-lg text-sm font-medium hover:bg-gray-200 transition-all">Hủy</button>
              <button onClick={addItem} className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-all">Thêm hàng hóa</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Receive Stock */}
      {showReceive && (
        <Modal title="Nhập kho" onClose={() => setShowReceive(false)}>
          <div className="space-y-3">
            <Select label={<>Chọn hàng hóa cần nhập <span className="text-red-500 font-bold ml-0.5">*</span></>} value={receiveData.itemId} onChange={(e: any) => setReceiveData({ ...receiveData, itemId: e.target.value })}
              options={[{ value: '', label: '-- Chọn hàng hóa --' }, ...items.map((i: any) => ({ value: i.id, label: `${i.name} (tồn: ${i.quantity} ${i.unit})` }))]} />
            <Input label={<>Số lượng nhập <span className="text-red-500 font-bold ml-0.5">*</span></>} type="number" value={receiveData.qty} onChange={(e: any) => setReceiveData({ ...receiveData, qty: e.target.value })} placeholder="0" />
            <Select label="Nhà cung cấp" value={receiveData.supplierId} onChange={(e: any) => setReceiveData({ ...receiveData, supplierId: e.target.value })}
              options={[{ value: '', label: '-- Không có --' }, ...suppliers.map((s: any) => ({ value: s.id, label: s.name }))]} />
            <Input label="Ghi chú" value={receiveData.note} onChange={(e: any) => setReceiveData({ ...receiveData, note: e.target.value })} placeholder="Ghi chú nhập kho" />
            <div className="flex justify-end space-x-2 pt-2">
              <button onClick={() => setShowReceive(false)} className="px-4 py-2 bg-surface-zen text-text-secondary rounded-lg text-sm font-medium hover:bg-gray-200 transition-all">Hủy</button>
              <button onClick={receiveStock} className="px-4 py-2 bg-success-zen text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-all">Xác nhận nhập</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Count Stock */}
      {showCount && (
        <Modal title="Kiểm kê tồn kho" onClose={() => setShowCount(false)}>
          <div className="space-y-3">
            <Select label={<>Chọn hàng hóa kiểm kê <span className="text-red-500 font-bold ml-0.5">*</span></>} value={countData.itemId} onChange={(e: any) => setCountData({ ...countData, itemId: e.target.value })}
              options={[{ value: '', label: '-- Chọn hàng hóa --' }, ...items.map((i: any) => ({ value: i.id, label: `${i.name} (tồn: ${i.quantity} ${i.unit})` }))]} />
            <Input label={<>Số lượng thực tế tại quầy <span className="text-red-500 font-bold ml-0.5">*</span></>} type="number" value={countData.countedQty} onChange={(e: any) => setCountData({ ...countData, countedQty: e.target.value })} placeholder="0" />
            <Input label="Ghi chú kiểm kê" value={countData.note} onChange={(e: any) => setCountData({ ...countData, note: e.target.value })} placeholder="Ghi chú kiểm kê" />
            <div className="flex justify-end space-x-2 pt-2">
              <button onClick={() => setShowCount(false)} className="px-4 py-2 bg-surface-zen text-text-secondary rounded-lg text-sm font-medium hover:bg-gray-200 transition-all">Hủy</button>
              <button onClick={countStock} className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 transition-all">Xác nhận kiểm kê</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Adjust Stock */}
      {showAdjust && (
        <Modal title="Điều chỉnh tồn kho" onClose={() => setShowAdjust(false)}>
          <div className="space-y-3">
            <Select label={<>Chọn hàng hóa điều chỉnh <span className="text-red-500 font-bold ml-0.5">*</span></>} value={adjustData.itemId} onChange={(e: any) => setAdjustData({ ...adjustData, itemId: e.target.value })}
              options={[{ value: '', label: '-- Chọn hàng hóa --' }, ...items.map((i: any) => ({ value: i.id, label: `${i.name} (tồn: ${i.quantity} ${i.unit})` }))]} />
            <Input label={<>Chênh lệch số lượng (+ hoặc -) <span className="text-red-500 font-bold ml-0.5">*</span></>} type="number" value={adjustData.deltaQty} onChange={(e: any) => setAdjustData({ ...adjustData, deltaQty: e.target.value })} placeholder="VD: 2 hoặc -1" />
            <Input label="Ghi chú điều chỉnh" value={adjustData.note} onChange={(e: any) => setAdjustData({ ...adjustData, note: e.target.value })} placeholder="Ghi chú điều chỉnh" />
            <div className="flex justify-end space-x-2 pt-2">
              <button onClick={() => setShowAdjust(false)} className="px-4 py-2 bg-surface-zen text-text-secondary rounded-lg text-sm font-medium hover:bg-gray-200 transition-all">Hủy</button>
              <button onClick={adjustStock} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-all">Xác nhận điều chỉnh</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Spoilage */}
      {showSpoilage && (
        <Modal title="Ghi nhận hàng hỏng/hết hạn" onClose={() => setShowSpoilage(false)}>
          <div className="space-y-3">
            <Select label={<>Chọn hàng hóa báo hủy <span className="text-red-500 font-bold ml-0.5">*</span></>} value={spoilageData.itemId} onChange={(e: any) => setSpoilageData({ ...spoilageData, itemId: e.target.value })}
              options={[{ value: '', label: '-- Chọn hàng hóa --' }, ...items.map((i: any) => ({ value: i.id, label: `${i.name} (tồn: ${i.quantity} ${i.unit})` }))]} />
            <Input label={<>Số lượng hủy <span className="text-red-500 font-bold ml-0.5">*</span></>} type="number" value={spoilageData.qty} onChange={(e: any) => setSpoilageData({ ...spoilageData, qty: e.target.value })} placeholder="0" />
            <Input label="Lý do báo hủy" value={spoilageData.note} onChange={(e: any) => setSpoilageData({ ...spoilageData, note: e.target.value })} placeholder="VD: Hết hạn, hỏng..." />
            <div className="flex justify-end space-x-2 pt-2">
              <button onClick={() => setShowSpoilage(false)} className="px-4 py-2 bg-surface-zen text-text-secondary rounded-lg text-sm font-medium hover:bg-gray-200 transition-all">Hủy</button>
              <button onClick={recordSpoilage} className="px-4 py-2 bg-error-zen text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-all">Xác nhận hủy</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Transfer to Truck */}
      {showTransfer && (
        <Modal title="Xuất hàng từ kho tổng cho xe" onClose={() => setShowTransfer(false)}>
          <div className="space-y-3">
            <Select label={<>Chọn hàng hóa xuất kho <span className="text-red-500 font-bold ml-0.5">*</span></>} value={transferData.itemId} onChange={(e: any) => setTransferData({ ...transferData, itemId: e.target.value })}
              options={[{ value: '', label: '-- Chọn hàng hóa --' }, ...warehouseItems.map((i: any) => ({ value: i.id, label: `${i.name} (tồn: ${i.quantity} ${i.unit})` }))]} />
            <Input label={<>Số lượng xuất <span className="text-red-500 font-bold ml-0.5">*</span></>} type="number" value={transferData.qty} onChange={(e: any) => setTransferData({ ...transferData, qty: e.target.value })} placeholder="0" />
            <Select label={<>Chọn xe nhận <span className="text-red-500 font-bold ml-0.5">*</span></>} value={transferData.toTruck} onChange={(e: any) => setTransferData({ ...transferData, toTruck: e.target.value })}
              options={[{ value: '', label: '-- Chọn xe --' }, ...trucks.filter((t: any) => t.status === 'ACTIVE').map((t: any) => ({ value: t.id, label: `${t.name} (${t.code})` }))]} />
            <Input label="Ghi chú xuất kho" value={transferData.note} onChange={(e: any) => setTransferData({ ...transferData, note: e.target.value })} placeholder="Ghi chú xuất kho" />
            <div className="flex justify-end space-x-2 pt-2">
              <button onClick={() => setShowTransfer(false)} className="px-4 py-2 bg-surface-zen text-text-secondary rounded-lg text-sm font-medium hover:bg-gray-200 transition-all">Hủy</button>
              <button onClick={transferToTruck} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-all">Xác nhận xuất</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Add BOM */}
      {showBom && (
        <Modal title="Thêm công thức chế biến" onClose={() => setShowBom(false)}>
          <div className="space-y-3">
            <Input label={<>Tên sản phẩm chế biến <span className="text-red-500 font-bold ml-0.5">*</span></>} value={bomData.productName} onChange={(e: any) => setBomData({ ...bomData, productName: e.target.value })} placeholder="VD: Trà sữa trân châu" />
            <Input label={<>Mã sản phẩm chế biến <span className="text-red-500 font-bold ml-0.5">*</span></>} value={bomData.productId} onChange={(e: any) => setBomData({ ...bomData, productId: e.target.value })} placeholder="VD: PROD-001" />
            <Input label={<>Tên nguyên liệu sử dụng <span className="text-red-500 font-bold ml-0.5">*</span></>} value={bomData.materialName} onChange={(e: any) => setBomData({ ...bomData, materialName: e.target.value })} placeholder="VD: Sữa tươi" />
            <Input label={<>Mã nguyên liệu sử dụng <span className="text-red-500 font-bold ml-0.5">*</span></>} value={bomData.materialId} onChange={(e: any) => setBomData({ ...bomData, materialId: e.target.value })} placeholder="VD: MAT-001" />
            <div className="grid grid-cols-2 gap-3">
              <Input label={<>Số lượng định mức <span className="text-red-500 font-bold ml-0.5">*</span></>} type="number" value={bomData.qty} onChange={(e: any) => setBomData({ ...bomData, qty: e.target.value })} placeholder="1" />
              <Input label={<>Đơn vị <span className="text-red-500 font-bold ml-0.5">*</span></>} value={bomData.unit} onChange={(e: any) => setBomData({ ...bomData, unit: e.target.value })} placeholder="pcs, ml, g..." />
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button onClick={() => setShowBom(false)} className="px-4 py-2 bg-surface-zen text-text-secondary rounded-lg text-sm font-medium hover:bg-gray-200 transition-all">Hủy</button>
              <button onClick={addBom} className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-all">Thêm công thức</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Add Supplier */}
      {showSupplier && (
        <Modal title="Thêm nhà cung cấp" onClose={() => setShowSupplier(false)}>
          <div className="space-y-3">
            <Input label={<>Tên nhà cung cấp <span className="text-red-500 font-bold ml-0.5">*</span></>} value={supplierData.name} onChange={(e: any) => setSupplierData({ ...supplierData, name: e.target.value })} placeholder="Nhập tên NCC" />
            <Input label={<>Số điện thoại liên hệ <span className="text-red-500 font-bold ml-0.5">*</span></>} value={supplierData.phone} onChange={(e: any) => setSupplierData({ ...supplierData, phone: e.target.value })} placeholder="Số điện thoại" />
            <Input label="Địa chỉ" value={supplierData.address} onChange={(e: any) => setSupplierData({ ...supplierData, address: e.target.value })} placeholder="Địa chỉ" />
            <Input label="Ghi chú" value={supplierData.note} onChange={(e: any) => setSupplierData({ ...supplierData, note: e.target.value })} placeholder="Ghi chú" />
            <div className="flex justify-end space-x-2 pt-2">
              <button onClick={() => setShowSupplier(false)} className="px-4 py-2 bg-surface-zen text-text-secondary rounded-lg text-sm font-medium hover:bg-gray-200 transition-all">Hủy</button>
              <button onClick={addSupplier} className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-all">Thêm NCC</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Add Truck */}
      {showTruck && (
        <Modal title="Thêm xe mới" onClose={() => setShowTruck(false)}>
          <div className="space-y-3">
            <Input label={<>Tên xe lưu động <span className="text-red-500 font-bold ml-0.5">*</span></>} value={truckData.name} onChange={(e: any) => setTruckData({ ...truckData, name: e.target.value })} placeholder="VD: Xe số 1" />
            <Input label={<>Mã hiệu xe <span className="text-red-500 font-bold ml-0.5">*</span></>} value={truckData.code} onChange={(e: any) => setTruckData({ ...truckData, code: e.target.value })} placeholder="VD: XE-001" />
            <Input label="Vị trí hoạt động" value={truckData.location} onChange={(e: any) => setTruckData({ ...truckData, location: e.target.value })} placeholder="VD: Cổng trường, Chợ..." />
            <Select label="Trạng thái" value={truckData.status} onChange={(e: any) => setTruckData({ ...truckData, status: e.target.value })}
              options={[{ value: 'ACTIVE', label: 'Hoạt động' }, { value: 'INACTIVE', label: 'Ngừng' }, { value: 'MAINTENANCE', label: 'Bảo trì' }]} />
            <div className="flex justify-end space-x-2 pt-2">
              <button onClick={() => setShowTruck(false)} className="px-4 py-2 bg-surface-zen text-text-secondary rounded-lg text-sm font-medium hover:bg-gray-200 transition-all">Hủy</button>
              <button onClick={addTruck} className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-all">Thêm xe</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

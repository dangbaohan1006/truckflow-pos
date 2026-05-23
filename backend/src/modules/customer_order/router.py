import json
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from src.core.database import get_session
from src.modules.auth.dependencies import get_current_user, get_optional_user, AuthUser
from .models import CustomerOrder, CustomerOrderItem, OrderNotification, MenuItem

router = APIRouter(prefix="/api/customer-orders", tags=["Customer Orders"])


# ===== Pydantic Schemas =====

class MenuItemSyncInput(BaseModel):
    id: str
    name: str
    price: str
    category: str
    unit: Optional[str] = ""
    default_discount: Optional[str] = "0"
    is_active: Optional[bool] = True
    image: Optional[str] = None


class MenuItemSyncPayload(BaseModel):
    menu_items: List[MenuItemSyncInput]


class OrderItemInput(BaseModel):
    menu_item_id: str
    product_name: str
    quantity: float = 1
    price: float = 0
    note: str = ""


class CreateOrderInput(BaseModel):
    table_number: str = "1"
    customer_name: str = "Khách"
    customer_phone: str = ""
    note: str = ""
    truck_id: str = ""
    items: List[OrderItemInput]


class UpdateOrderInput(BaseModel):
    items: Optional[List[OrderItemInput]] = None
    staff_note: Optional[str] = None
    note: Optional[str] = None


class OrderItemResponse(BaseModel):
    id: str
    menu_item_id: str
    product_name: str
    quantity: float
    price: float
    note: str


class OrderResponse(BaseModel):
    id: str
    table_number: str
    customer_name: str
    customer_phone: str
    note: str
    status: str
    truck_id: str
    staff_note: str
    items: List[OrderItemResponse] = []
    created_at: int
    updated_at: int


class NotificationResponse(BaseModel):
    id: str
    order_id: str
    type: str
    message: str
    is_read: bool
    created_at: int


# ===== Helpers =====

def _now_ts() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def _order_to_response(order: CustomerOrder, items: List[CustomerOrderItem] = None) -> dict:
    return {
        "id": order.id,
        "table_number": order.table_number,
        "customer_name": order.customer_name,
        "customer_phone": order.customer_phone or "",
        "note": order.note or "",
        "status": order.status,
        "truck_id": order.truck_id or "",
        "staff_note": order.staff_note or "",
        "items": [
            {
                "id": item.id,
                "menu_item_id": item.menu_item_id,
                "product_name": item.product_name,
                "quantity": float(item.quantity),
                "price": float(item.price),
                "note": item.note or "",
            }
            for item in (items or [])
        ] if items else [],
        "created_at": int(order.created_at.timestamp() * 1000) if order.created_at else _now_ts(),
        "updated_at": int(order.updated_at.timestamp() * 1000) if order.updated_at else _now_ts(),
    }


def _create_notification(session, order_id: str, notif_type: str, message: str):
    notif = OrderNotification(
        id=str(uuid.uuid4()),
        order_id=order_id,
        type=notif_type,
        message=message,
        is_read="false",
    )
    session.add(notif)


# ===== API Endpoints =====

@router.post("", response_model=dict)
async def create_order(input_data: CreateOrderInput):
    """Khách hàng gửi đơn (không cần auth)"""
    session = get_session()
    try:
        order_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)

        order = CustomerOrder(
            id=order_id,
            table_number=input_data.table_number,
            customer_name=input_data.customer_name,
            customer_phone=input_data.customer_phone,
            note=input_data.note,
            status="PENDING",
            truck_id=input_data.truck_id,
            created_at=now,
            updated_at=now,
        )
        session.add(order)

        for item in input_data.items:
            order_item = CustomerOrderItem(
                id=str(uuid.uuid4()),
                order_id=order_id,
                menu_item_id=item.menu_item_id,
                product_name=item.product_name,
                quantity=Decimal(str(item.quantity)),
                price=Decimal(str(item.price)),
                note=item.note,
                created_at=now,
                updated_at=now,
            )
            session.add(order_item)

        # Tạo notification cho nhân viên
        table_info = f"Bàn {input_data.table_number}" if input_data.table_number else "Khách mang về"
        customer_info = input_data.customer_name or "Khách"
        notif_msg = f"Đơn mới từ {customer_info} - {table_info}"
        _create_notification(session, order_id, "NEW_ORDER", notif_msg)

        session.commit()

        return {
            "success": True,
            "order_id": order_id,
            "message": "Đơn hàng đã được gửi thành công!",
        }
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        session.close()


@router.get("/pending", response_model=List[dict])
async def get_pending_orders(
    truck_id: Optional[str] = Query(None),
    current_user: AuthUser = Depends(get_current_user),
):
    """Nhân viên lấy danh sách đơn PENDING + CONFIRMED"""
    session = get_session()
    try:
        query = session.query(CustomerOrder).filter(
            CustomerOrder.status.in_(["PENDING", "CONFIRMED"])
        ).order_by(CustomerOrder.created_at.desc())

        if truck_id:
            query = query.filter(CustomerOrder.truck_id == truck_id)

        orders = query.all()
        result = []
        for order in orders:
            items = session.query(CustomerOrderItem).filter(
                CustomerOrderItem.order_id == order.id
            ).all()
            result.append(_order_to_response(order, items))

        return result
    finally:
        session.close()


@router.get("/all", response_model=List[dict])
async def get_all_orders(
    status: Optional[str] = Query(None),
    truck_id: Optional[str] = Query(None),
    current_user: AuthUser = Depends(get_current_user),
):
    """Nhân viên lấy tất cả đơn hàng (có filter)"""
    session = get_session()
    try:
        query = session.query(CustomerOrder)

        if status:
            query = query.filter(CustomerOrder.status == status)
        if truck_id:
            query = query.filter(CustomerOrder.truck_id == truck_id)

        orders = query.order_by(CustomerOrder.created_at.desc()).limit(50).all()
        result = []
        for order in orders:
            items = session.query(CustomerOrderItem).filter(
                CustomerOrderItem.order_id == order.id
            ).all()
            result.append(_order_to_response(order, items))

        return result
    finally:
        session.close()


@router.get("/{order_id}", response_model=dict)
async def get_order_detail(
    order_id: str,
    current_user: AuthUser = Depends(get_current_user),
):
    """Nhân viên xem chi tiết đơn"""
    session = get_session()
    try:
        order = session.query(CustomerOrder).filter(CustomerOrder.id == order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")

        items = session.query(CustomerOrderItem).filter(
            CustomerOrderItem.order_id == order_id
        ).all()

        return _order_to_response(order, items)
    finally:
        session.close()


@router.put("/{order_id}/confirm", response_model=dict)
async def confirm_order(
    order_id: str,
    current_user: AuthUser = Depends(get_current_user),
):
    """Nhân viên xác nhận đơn → in bill"""
    session = get_session()
    try:
        order = session.query(CustomerOrder).filter(CustomerOrder.id == order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")

        if order.status != "PENDING":
            raise HTTPException(status_code=400, detail="Đơn hàng không ở trạng thái chờ xác nhận")

        order.status = "CONFIRMED"
        order.updated_at = datetime.now(timezone.utc)

        # Tạo notification
        _create_notification(
            session,
            order_id,
            "CONFIRMED",
            f"Đơn bàn {order.table_number} - {order.customer_name} đã được xác nhận",
        )

        session.commit()

        return {
            "success": True,
            "message": "Đơn hàng đã được xác nhận!",
            "order_id": order_id,
            "print_bill": True,  # Frontend sẽ biết cần in bill
        }
    except HTTPException:
        session.rollback()
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        session.close()


@router.put("/{order_id}/update", response_model=dict)
async def update_order(
    order_id: str,
    input_data: UpdateOrderInput,
    current_user: AuthUser = Depends(get_current_user),
):
    """Nhân viên chỉnh sửa đơn"""
    session = get_session()
    try:
        order = session.query(CustomerOrder).filter(CustomerOrder.id == order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")

        now = datetime.now(timezone.utc)

        if input_data.staff_note is not None:
            order.staff_note = input_data.staff_note
        if input_data.note is not None:
            order.note = input_data.note

        # Cập nhật items nếu có
        if input_data.items is not None:
            # Xóa items cũ
            session.query(CustomerOrderItem).filter(
                CustomerOrderItem.order_id == order_id
            ).delete()

            # Thêm items mới
            for item in input_data.items:
                order_item = CustomerOrderItem(
                    id=str(uuid.uuid4()),
                    order_id=order_id,
                    menu_item_id=item.menu_item_id,
                    product_name=item.product_name,
                    quantity=Decimal(str(item.quantity)),
                    price=Decimal(str(item.price)),
                    note=item.note,
                    created_at=now,
                    updated_at=now,
                )
                session.add(order_item)

        order.updated_at = now

        # Tạo notification
        _create_notification(
            session,
            order_id,
            "UPDATED",
            f"Đơn bàn {order.table_number} đã được nhân viên cập nhật",
        )

        session.commit()

        return {
            "success": True,
            "message": "Đơn hàng đã được cập nhật!",
        }
    except HTTPException:
        session.rollback()
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        session.close()


@router.put("/{order_id}/cancel", response_model=dict)
async def cancel_order(
    order_id: str,
    current_user: AuthUser = Depends(get_current_user),
):
    """Nhân viên hủy đơn"""
    session = get_session()
    try:
        order = session.query(CustomerOrder).filter(CustomerOrder.id == order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")

        order.status = "CANCELLED"
        order.updated_at = datetime.now(timezone.utc)

        _create_notification(
            session,
            order_id,
            "CANCELLED",
            f"Đơn bàn {order.table_number} - {order.customer_name} đã bị hủy",
        )

        session.commit()

        return {"success": True, "message": "Đơn hàng đã bị hủy!"}
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        session.close()


@router.put("/{order_id}/complete", response_model=dict)
async def complete_order(
    order_id: str,
    current_user: AuthUser = Depends(get_current_user),
):
    """Nhân viên hoàn tất đơn"""
    session = get_session()
    try:
        order = session.query(CustomerOrder).filter(CustomerOrder.id == order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")

        order.status = "COMPLETED"
        order.updated_at = datetime.now(timezone.utc)

        session.commit()

        return {"success": True, "message": "Đơn hàng đã hoàn tất!"}
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        session.close()


# ===== Notifications =====

@router.get("/notifications/unread", response_model=List[dict])
async def get_unread_notifications(
    current_user: AuthUser = Depends(get_current_user),
):
    """Nhân viên lấy notifications chưa đọc"""
    session = get_session()
    try:
        notifs = session.query(OrderNotification).filter(
            OrderNotification.is_read == "false"
        ).order_by(OrderNotification.created_at.desc()).limit(50).all()

        return [
            {
                "id": n.id,
                "order_id": n.order_id,
                "type": n.type,
                "message": n.message,
                "is_read": n.is_read == "true",
                "created_at": int(n.created_at.timestamp() * 1000) if n.created_at else 0,
            }
            for n in notifs
        ]
    finally:
        session.close()


@router.get("/notifications/all", response_model=List[dict])
async def get_all_notifications(
    current_user: AuthUser = Depends(get_current_user),
):
    """Nhân viên lấy tất cả notifications"""
    session = get_session()
    try:
        notifs = session.query(OrderNotification).order_by(
            OrderNotification.created_at.desc()
        ).limit(100).all()

        return [
            {
                "id": n.id,
                "order_id": n.order_id,
                "type": n.type,
                "message": n.message,
                "is_read": n.is_read == "true",
                "created_at": int(n.created_at.timestamp() * 1000) if n.created_at else 0,
            }
            for n in notifs
        ]
    finally:
        session.close()


@router.put("/notifications/{notif_id}/read", response_model=dict)
async def mark_notification_read(
    notif_id: str,
    current_user: AuthUser = Depends(get_current_user),
):
    """Đánh dấu notification đã đọc"""
    session = get_session()
    try:
        notif = session.query(OrderNotification).filter(
            OrderNotification.id == notif_id
        ).first()
        if not notif:
            raise HTTPException(status_code=404, detail="Không tìm thấy notification")

        notif.is_read = "true"
        session.commit()

        return {"success": True, "message": "Đã đánh dấu đã đọc"}
    except HTTPException:
        session.rollback()
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        session.close()


@router.put("/notifications/read-all", response_model=dict)
async def mark_all_notifications_read(
    current_user: AuthUser = Depends(get_current_user),
):
    """Đánh dấu tất cả notifications đã đọc"""
    session = get_session()
    try:
        session.query(OrderNotification).filter(
            OrderNotification.is_read == "false"
        ).update({"is_read": "true"})
        session.commit()

        return {"success": True, "message": "Đã đánh dấu tất cả đã đọc"}
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        session.close()


# ===== Customer Menu Sync & Fetch =====

@router.post("/menu/sync", response_model=dict)
async def sync_menu_items(
    payload: MenuItemSyncPayload,
    current_user: AuthUser = Depends(get_current_user),
):
    """Đồng bộ thực đơn từ thiết bị Thu ngân lên backend (cần auth)"""
    session = get_session()
    try:
        now = datetime.now(timezone.utc)
        # Upsert sent menu items
        for item in payload.menu_items:
            existing = session.query(MenuItem).filter(MenuItem.id == item.id).first()
            is_active_str = "true" if item.is_active else "false"
            
            if existing:
                existing.name = item.name
                existing.price = item.price
                existing.category = item.category
                existing.unit = item.unit or ""
                existing.default_discount = item.default_discount or "0"
                existing.is_active = is_active_str
                existing.image = item.image
                existing.updated_at = now
            else:
                new_item = MenuItem(
                    id=item.id,
                    name=item.name,
                    price=item.price,
                    category=item.category,
                    unit=item.unit or "",
                    default_discount=item.default_discount or "0",
                    is_active=is_active_str,
                    image=item.image,
                    created_at=now,
                    updated_at=now,
                )
                session.add(new_item)
                
        # Delete items no longer in sent list
        sent_ids = [item.id for item in payload.menu_items]
        if sent_ids:
            session.query(MenuItem).filter(~MenuItem.id.in_(sent_ids)).delete(synchronize_session=False)
            
        session.commit()
        return {"success": True, "message": f"Đồng bộ thành công {len(payload.menu_items)} món ăn!"}
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        session.close()


@router.get("/menu", response_model=List[dict])
async def get_customer_menu():
    """Khách hàng lấy danh sách thực đơn hoạt động (không cần auth)"""
    session = get_session()
    try:
        items = session.query(MenuItem).filter(MenuItem.is_active == "true").all()
        return [
            {
                "id": item.id,
                "name": item.name,
                "price": item.price,
                "category": item.category,
                "unit": item.unit or "",
                "defaultDiscount": item.default_discount or "0",
                "image": item.image or "",
                "isActive": True,
            }
            for item in items
        ]
    finally:
        session.close()


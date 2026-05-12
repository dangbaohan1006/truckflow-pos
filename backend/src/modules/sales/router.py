from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from decimal import Decimal
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from ...core.database import get_session
from .models import PosOrder, PosOrderLine
from ...core.outbox import save_outbox

router = APIRouter()


class PushOrderLine(BaseModel):
    id: str
    order_id: str
    product_id: str
    quantity: str
    price: str
    updated_at: Optional[int] = None


class PushOrder(BaseModel):
    id: str
    total_amount: str
    status: Optional[str] = "created"
    updated_at: Optional[int] = None
    
    
class PushChangesData(BaseModel):
    pos_order: Dict[str, List[PushOrder]] = {"created": [], "updated": [], "deleted": []}
    pos_order_line: Dict[str, List[PushOrderLine]] = {"created": [], "updated": [], "deleted": []}


class PushChanges(BaseModel):
    lastPulledAt: Optional[int] = None
    changes: PushChangesData


@router.get("/sync")
async def pull_sync(lastPulledAt: Optional[int] = None):
    session = get_session()
    try:
        pull_changes = {"pos_order": {"created": [], "updated": [], "deleted": []}, "pos_order_line": {"created": [], "updated": [], "deleted": []}}
        now_ts = int(datetime.now(timezone.utc).timestamp() * 1000)
        
        if lastPulledAt is not None:
            last_pulled_dt = datetime.fromtimestamp(lastPulledAt / 1000.0, tz=timezone.utc)
            
            updated_orders = session.query(PosOrder).filter(PosOrder.updated_at > last_pulled_dt).all()
            for o in updated_orders:
                pull_changes["pos_order"]["updated"].append({
                    "id": o.id,
                    "total_amount": str(o.total_amount),
                    "status": o.status,
                    "updated_at": int(o.updated_at.timestamp() * 1000) if o.updated_at else now_ts
                })
                
            updated_lines = session.query(PosOrderLine).filter(PosOrderLine.updated_at > last_pulled_dt).all()
            for l in updated_lines:
                pull_changes["pos_order_line"]["updated"].append({
                    "id": l.id,
                    "order_id": l.order_id,
                    "product_id": l.product_id,
                    "quantity": str(l.quantity),
                    "price": str(l.price),
                    "updated_at": int(l.updated_at.timestamp() * 1000) if l.updated_at else now_ts
                })
        
        return {"changes": pull_changes, "timestamp": now_ts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        session.close()

@router.post("/sync")
async def push_sync(payload: PushChanges):
    session = get_session()
    
    try:
        modified_order_ids = set()
        
        # 1. Process Orders (Last-Write-Wins)
        orders_to_process = payload.changes.pos_order.get("created", []) + payload.changes.pos_order.get("updated", [])
        for order_data in orders_to_process:
            order = session.query(PosOrder).filter_by(id=order_data.id).first()
            if order:
                device_time = datetime.fromtimestamp(order_data.updated_at / 1000.0, tz=timezone.utc) if order_data.updated_at else datetime.now(timezone.utc)
                if not order.updated_at or device_time > order.updated_at:
                    order.total_amount = Decimal(order_data.total_amount)
                    if order_data.status:
                        order.status = order_data.status
                    if order_data.updated_at:
                        order.updated_at = device_time
            else:
                order = PosOrder(
                    id=order_data.id,
                    total_amount=Decimal(order_data.total_amount),
                    status=order_data.status or "created"
                )
                if order_data.updated_at:
                    order.updated_at = datetime.fromtimestamp(order_data.updated_at / 1000.0, tz=timezone.utc)
                session.add(order)
            modified_order_ids.add(order.id)

        # 2. Process Order Lines (Last-Write-Wins)
        lines_to_process = payload.changes.pos_order_line.get("created", []) + payload.changes.pos_order_line.get("updated", [])
        for line_data in lines_to_process:
            line = session.query(PosOrderLine).filter_by(id=line_data.id).first()
            if line:
                device_time = datetime.fromtimestamp(line_data.updated_at / 1000.0, tz=timezone.utc) if line_data.updated_at else datetime.now(timezone.utc)
                if not line.updated_at or device_time > line.updated_at:
                    line.quantity = Decimal(line_data.quantity)
                    line.price = Decimal(line_data.price)
                    if line_data.updated_at:
                        line.updated_at = device_time
            else:
                line = PosOrderLine(
                    id=line_data.id,
                    order_id=line_data.order_id,
                    product_id=line_data.product_id,
                    quantity=Decimal(line_data.quantity),
                    price=Decimal(line_data.price)
                )
                if line_data.updated_at:
                    line.updated_at = datetime.fromtimestamp(line_data.updated_at / 1000.0, tz=timezone.utc)
                session.add(line)
            modified_order_ids.add(line.order_id)

        # 3. Fire Outbox Events
        for order_id in modified_order_ids:
            order = session.query(PosOrder).filter_by(id=order_id).first()
            if not order:
                continue
            
            lines = session.query(PosOrderLine).filter_by(order_id=order_id).all()
            lines_payload = [
                {"product_id": line.product_id, "qty": str(line.quantity), "price": str(line.price)}
                for line in lines
            ]
            
            save_outbox(
                session=session,
                aggregate_type="PosOrder",
                aggregate_id=order.id,
                event_type="OrderUpdated",
                payload={
                    "id": order.id, 
                    "total_amount": str(order.total_amount),
                    "lines": lines_payload
                }
            )

        session.commit()
        return {"success": True}
        
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        session.close()

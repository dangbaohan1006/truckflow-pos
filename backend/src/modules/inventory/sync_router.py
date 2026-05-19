"""
Inventory Sync Router (WatermelonDB protocol)

Provides pull/push sync endpoints for inventory tables:
  - inventory_items
  - stock_movements

Follows the same pattern as the sales sync router.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ...core.database import get_session
from ...core.outbox import save_outbox
from .models import InventoryLevel, StockMove

router = APIRouter(prefix="/api/inventory", tags=["Inventory Sync"])


# ============================================================
# Pydantic models for the WatermelonDB sync protocol
# ============================================================

class SyncInventoryItem(BaseModel):
    id: str
    name: Optional[str] = None
    sku: Optional[str] = None
    unit: Optional[str] = None
    quantity: Optional[str] = None
    reorder_level: Optional[str] = None
    price: Optional[str] = None
    category: Optional[str] = None
    is_raw_material: Optional[bool] = None
    location_type: Optional[str] = None
    truck_id: Optional[str] = None
    created_at: Optional[int] = None
    updated_at: Optional[int] = None


class SyncStockMovement(BaseModel):
    id: str
    item_id: Optional[str] = None
    item_name: Optional[str] = None
    quantity: Optional[str] = None
    type: Optional[str] = None
    reference_id: Optional[str] = None
    note: Optional[str] = None
    created_at: Optional[int] = None
    updated_at: Optional[int] = None


class ChangesBlock(BaseModel):
    created: list[SyncInventoryItem] = []
    updated: list[SyncInventoryItem] = []
    deleted: list[str] = []


class StockMovementsBlock(BaseModel):
    created: list[SyncStockMovement] = []
    updated: list[SyncStockMovement] = []
    deleted: list[str] = []


class InventoryChanges(BaseModel):
    inventory_items: ChangesBlock = ChangesBlock()
    stock_movements: StockMovementsBlock = StockMovementsBlock()


class PushPayload(BaseModel):
    lastPulledAt: Optional[int] = None
    changes: InventoryChanges


# ============================================================
# Helpers
# ============================================================

def _now_ms() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def _to_ms(dt: datetime | None) -> int:
    if dt is None:
        return _now_ms()
    return int(dt.timestamp() * 1000)


def _to_dt(ts: int | None) -> datetime:
    if ts is None:
        return datetime.now(timezone.utc)
    return datetime.fromtimestamp(ts / 1000.0, tz=timezone.utc)


# ============================================================
# GET /api/inventory/sync — Pull changes
# ============================================================

@router.get("/sync")
async def pull_inventory_sync(
    lastPulledAt: Optional[int] = Query(None, alias="lastPulledAt"),
):
    """Pull inventory changes since lastPulledAt (WatermelonDB protocol)."""
    session = get_session()
    try:
        now_ts = _now_ms()
        pull_changes = {
            "inventory_items": {"created": [], "updated": [], "deleted": []},
            "stock_movements": {"created": [], "updated": [], "deleted": []},
        }

        if lastPulledAt is not None and lastPulledAt > 0:
            last_pulled_dt = _to_dt(lastPulledAt)

            # Pull updated inventory levels
            updated_levels = (
                session.query(InventoryLevel)
                .filter(InventoryLevel.updated_at > last_pulled_dt)
                .all()
            )
            for level in updated_levels:
                pull_changes["inventory_items"]["updated"].append(
                    {
                        "id": f"inv_{level.product_id}",
                        "sku": level.product_id,
                        "quantity": str(level.quantity),
                        "updated_at": _to_ms(level.updated_at),
                    }
                )

            # Pull updated stock moves
            updated_moves = (
                session.query(StockMove)
                .filter(StockMove.created_at > last_pulled_dt)
                .all()
            )
            for move in updated_moves:
                pull_changes["stock_movements"]["updated"].append(
                    {
                        "id": f"move_{move.id}",
                        "item_id": move.product_id,
                        "quantity": str(move.quantity),
                        "type": _move_type_from_origin(move.origin),
                        "reference_id": move.origin or "",
                        "note": (move.meta or {}).get("note", "") if move.meta else "",
                        "created_at": _to_ms(move.created_at),
                        "updated_at": _to_ms(move.created_at),
                    }
                )

        return {"changes": pull_changes, "timestamp": now_ts}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        session.close()


# ============================================================
# POST /api/inventory/sync — Push changes
# ============================================================

@router.post("/sync")
async def push_inventory_sync(payload: PushPayload):
    """Push inventory changes from the device (WatermelonDB protocol)."""
    session = get_session()
    try:
        changes = payload.changes
        modified_product_ids: set[str] = set()

        # Process inventory_items
        items_block = changes.inventory_items
        for item_data in items_block.created + items_block.updated:
            product_id = str(item_data.sku or item_data.id)
            if not product_id:
                continue

            qty_str = item_data.quantity or "0"
            try:
                qty = Decimal(qty_str)
            except Exception:
                qty = Decimal("0")

            level = (
                session.query(InventoryLevel)
                .filter(InventoryLevel.product_id == product_id)
                .one_or_none()
            )
            if level:
                # Only update if the incoming timestamp is newer
                incoming_ts = _to_dt(item_data.updated_at)
                if level.updated_at is None or incoming_ts > level.updated_at:
                    level.quantity = qty
                    if item_data.updated_at:
                        level.updated_at = incoming_ts
            else:
                level = InventoryLevel(
                    product_id=product_id,
                    quantity=qty,
                )
                session.add(level)

            modified_product_ids.add(product_id)

        # Process stock_movements
        moves_block = changes.stock_movements
        for move_data in moves_block.created + moves_block.updated:
            product_id = str(move_data.item_id or "")
            if not product_id:
                continue

            qty_str = move_data.quantity or "0"
            try:
                qty = Decimal(qty_str)
            except Exception:
                qty = Decimal("0")

            move_type = move_data.type or "ADJUSTMENT"
            origin = move_data.reference_id or move_type

            move = StockMove(
                product_id=product_id,
                quantity=qty,
                origin=origin,
                meta={
                    "note": move_data.note or "",
                    "item_name": move_data.item_name or "",
                    "move_type": move_type,
                    "synced_from_device": True,
                },
            )
            session.add(move)

            # Also update inventory level
            level = (
                session.query(InventoryLevel)
                .filter(InventoryLevel.product_id == product_id)
                .one_or_none()
            )
            if level:
                level.quantity = Decimal(level.quantity) + qty
            else:
                level = InventoryLevel(product_id=product_id, quantity=qty)
                session.add(level)

            modified_product_ids.add(product_id)

        # Emit outbox events for modified products
        for product_id in modified_product_ids:
            level = (
                session.query(InventoryLevel)
                .filter(InventoryLevel.product_id == product_id)
                .one_or_none()
            )
            if level:
                save_outbox(
                    session=session,
                    aggregate_type="InventoryLevel",
                    aggregate_id=product_id,
                    event_type="InventoryUpdated",
                    payload={
                        "product_id": product_id,
                        "quantity": str(level.quantity),
                    },
                )

        session.commit()
        return {"success": True}

    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        session.close()


# ============================================================
# Helpers
# ============================================================

def _move_type_from_origin(origin: str | None) -> str:
    """Map origin string to a stock movement type."""
    if not origin:
        return "ADJUSTMENT"
    origin_lower = origin.lower()
    if origin_lower.startswith("receive"):
        return "RECEIVE"
    if origin_lower.startswith("issue") or origin_lower.startswith("spoilage"):
        return "SPOILAGE"
    if origin_lower.startswith("order"):
        return "SALE"
    if origin_lower.startswith("adjust"):
        return "ADJUSTMENT"
    if origin_lower.startswith("count"):
        return "ADJUSTMENT"
    if origin_lower.startswith("transfer"):
        return "TRANSFER_OUT"
    return "ADJUSTMENT"

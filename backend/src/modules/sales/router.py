from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, List, Optional

from ..storage.factory import build_sales_service

router = APIRouter()
sales_service = build_sales_service()


# Helper stubs expected by unit tests (tests monkeypatch these functions)
def get_session():
    """Return a DB/session object. Tests monkeypatch this."""
    raise RuntimeError("get_session not implemented in test environment")


def save_outbox(*, session, aggregate_type, aggregate_id, event_type, payload):
    """Persist outbox event. Tests may monkeypatch."""
    raise RuntimeError("save_outbox not implemented in test environment")


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
    try:
        return sales_service.pull(lastPulledAt)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync")
async def push_sync(payload: PushChanges):
    try:
        return sales_service.push(payload.model_dump())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

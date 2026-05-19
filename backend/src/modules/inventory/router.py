from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..auth.dependencies import AuthUser, require_permission
from ..auth.permissions import PERMISSIONS
from src.modules.storage.factory import build_inventory_service

router = APIRouter(prefix="/api/inventory", tags=["Inventory"])
inventory_service = build_inventory_service()


class InventoryLine(BaseModel):
    product_id: str = Field(..., min_length=1)
    quantity: str = Field(..., min_length=1)


class CountLine(BaseModel):
    product_id: str = Field(..., min_length=1)
    counted_quantity: str = Field(..., min_length=1)


class AdjustLine(BaseModel):
    product_id: str = Field(..., min_length=1)
    delta_quantity: str = Field(...)


class InventoryMutationRequest(BaseModel):
    items: list[InventoryLine]
    location_id: Optional[str] = None
    reference: Optional[str] = None
    note: Optional[str] = None


class CountRequest(BaseModel):
    items: list[CountLine]
    location_id: Optional[str] = None
    reference: Optional[str] = None
    note: Optional[str] = None


class AdjustRequest(BaseModel):
    items: list[AdjustLine]
    location_id: Optional[str] = None
    reference: Optional[str] = None
    note: Optional[str] = None


class InventoryResponse(BaseModel):
    success: bool
    operation: str
    moves: list[dict]


@router.post("/receive", response_model=InventoryResponse)
async def receive_inventory(
    request: InventoryMutationRequest,
    current_user: AuthUser = Depends(require_permission(PERMISSIONS["INV_RECEIVE"])),
):
    try:
        moves = inventory_service.receive(
            items=[item.model_dump() for item in request.items],
            location_id=request.location_id,
            reference=request.reference,
            note=request.note,
            actor_id=current_user.id,
        )
        return InventoryResponse(success=True, operation="receive", moves=moves)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/issue", response_model=InventoryResponse)
async def issue_inventory(
    request: InventoryMutationRequest,
    current_user: AuthUser = Depends(require_permission(PERMISSIONS["INV_ISSUE"])),
):
    try:
        moves = inventory_service.issue(
            items=[item.model_dump() for item in request.items],
            location_id=request.location_id,
            reference=request.reference,
            note=request.note,
            actor_id=current_user.id,
        )
        return InventoryResponse(success=True, operation="issue", moves=moves)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/count", response_model=InventoryResponse)
async def count_inventory(
    request: CountRequest,
    current_user: AuthUser = Depends(require_permission(PERMISSIONS["INV_COUNT"])),
):
    try:
        moves = inventory_service.count(
            items=[item.model_dump() for item in request.items],
            location_id=request.location_id,
            reference=request.reference,
            note=request.note,
            actor_id=current_user.id,
        )
        return InventoryResponse(success=True, operation="count", moves=moves)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/adjust", response_model=InventoryResponse)
async def adjust_inventory(
    request: AdjustRequest,
    current_user: AuthUser = Depends(require_permission(PERMISSIONS["INV_ADJUST"])),
):
    try:
        moves = inventory_service.adjust(
            items=[item.model_dump() for item in request.items],
            location_id=request.location_id,
            reference=request.reference,
            note=request.note,
            actor_id=current_user.id,
        )
        return InventoryResponse(success=True, operation="adjust", moves=moves)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
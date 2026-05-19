from __future__ import annotations

from enum import Enum
from typing import Any, Protocol


class StorageBackend(str, Enum):
    GOOGLE_SHEETS = "google_sheets"
    POSTGRES = "postgres"


class SalesRepository(Protocol):
    def pull_sync(self, last_pulled_at: int | None = None) -> dict[str, Any]:
        raise NotImplementedError

    def push_sync(self, payload: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError


class InventoryRepository(Protocol):
    def apply_inventory_operation(
        self,
        operation: str,
        items: list[dict[str, Any]],
        location_id: str | None = None,
        reference: str | None = None,
        note: str | None = None,
        actor_id: str | None = None,
    ) -> list[dict[str, Any]]:
        raise NotImplementedError

    def apply_materials_from_order(
        self,
        order_id: str,
        order_lines: list[dict[str, Any]],
        location_id: str | None = None,
    ) -> list[dict[str, Any]]:
        raise NotImplementedError

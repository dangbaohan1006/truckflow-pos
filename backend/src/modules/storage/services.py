from __future__ import annotations

from typing import Any

from .contracts import InventoryRepository, SalesRepository


class SalesSyncService:
    def __init__(self, repository: SalesRepository) -> None:
        self.repository = repository

    def pull(self, last_pulled_at: int | None = None) -> dict[str, Any]:
        return self.repository.pull_sync(last_pulled_at=last_pulled_at)

    def push(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self.repository.push_sync(payload)


class InventoryService:
    def __init__(self, repository: InventoryRepository) -> None:
        self.repository = repository

    def receive(
        self,
        items: list[dict[str, Any]],
        location_id: str | None = None,
        reference: str | None = None,
        note: str | None = None,
        actor_id: str | None = None,
    ) -> list[dict[str, Any]]:
        return self.repository.apply_inventory_operation(
            operation="receive",
            items=items,
            location_id=location_id,
            reference=reference,
            note=note,
            actor_id=actor_id,
        )

    def issue(
        self,
        items: list[dict[str, Any]],
        location_id: str | None = None,
        reference: str | None = None,
        note: str | None = None,
        actor_id: str | None = None,
    ) -> list[dict[str, Any]]:
        return self.repository.apply_inventory_operation(
            operation="issue",
            items=items,
            location_id=location_id,
            reference=reference,
            note=note,
            actor_id=actor_id,
        )

    def count(
        self,
        items: list[dict[str, Any]],
        location_id: str | None = None,
        reference: str | None = None,
        note: str | None = None,
        actor_id: str | None = None,
    ) -> list[dict[str, Any]]:
        return self.repository.apply_inventory_operation(
            operation="count",
            items=items,
            location_id=location_id,
            reference=reference,
            note=note,
            actor_id=actor_id,
        )

    def adjust(
        self,
        items: list[dict[str, Any]],
        location_id: str | None = None,
        reference: str | None = None,
        note: str | None = None,
        actor_id: str | None = None,
    ) -> list[dict[str, Any]]:
        return self.repository.apply_inventory_operation(
            operation="adjust",
            items=items,
            location_id=location_id,
            reference=reference,
            note=note,
            actor_id=actor_id,
        )

    def apply_materials_from_order(
        self,
        order_id: str,
        order_lines: list[dict[str, Any]],
        location_id: str | None = None,
    ) -> list[dict[str, Any]]:
        return self.repository.apply_materials_from_order(order_id, order_lines, location_id=location_id)

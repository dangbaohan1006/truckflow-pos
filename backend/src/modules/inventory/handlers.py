from __future__ import annotations

from typing import Any

from src.modules.storage.factory import build_inventory_service


inventory_service = build_inventory_service()


def apply_materials_from_order(session, order_id: str, order_lines: list, location_id: str | None = None):
    """Apply inventory consumption through the storage adapter layer."""
    normalized_lines: list[dict[str, Any]] = []
    for line in order_lines:
        if isinstance(line, dict):
            normalized_lines.append(line)
        else:
            normalized_lines.append({
                "product_id": getattr(line, "product_id", None),
                "qty": getattr(line, "qty", getattr(line, "quantity", None)),
            })

    return inventory_service.apply_materials_from_order(order_id, normalized_lines, location_id=location_id)

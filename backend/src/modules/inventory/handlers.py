.vfrom decimal import Decimal
from src.core.database import get_session
from .models import InventoryLevel, StockMove
from .bom_engine import compute_materials_for_order


def apply_materials_from_order(session, order_id: str, order_lines: list, location_id: str | None = None):
    """Compute materials via BOM and create StockMove + update InventoryLevel.

    - Allows negative inventory.
    - Marks StockMove.needs_audit = True when resulting quantity < 0.
    """
    materials = compute_materials_for_order(session, order_lines)
    moves = []
    for material_id, qty in materials.items():
        # qty is Decimal
        inv = session.query(InventoryLevel).filter(InventoryLevel.product_id == material_id).one_or_none()
        if not inv:
            inv = InventoryLevel(product_id=material_id, quantity=Decimal("0"))
            session.add(inv)
            session.flush()

        new_qty = Decimal(inv.quantity) - Decimal(qty)

        needs_audit = new_qty < 0

        # create stock move
        move = StockMove(
            product_id=material_id,
            location_id=location_id,
            quantity=-Decimal(qty),
            needs_audit=needs_audit,
            origin=f"order:{order_id}",
        )
        session.add(move)

        # update inventory level (allow negative)
        inv.quantity = new_qty

        moves.append(move)

    # Note: commit should be handled by caller (outbox processor)
    return moves

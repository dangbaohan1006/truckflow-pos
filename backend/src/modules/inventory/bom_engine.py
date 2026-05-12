from decimal import Decimal, getcontext
from typing import List, Dict
from .models import MrpBOM
from src.core.database import get_session

# Ensure sufficient precision
getcontext().prec = 28


def compute_materials_for_order(session, order_lines: List[Dict]) -> Dict[str, Decimal]:
    """Given order_lines = [{"product_id": str, "qty": "Decimal or number"}, ...]
    return mapping material_id -> total_qty required as Decimal.
    """
    required = {}
    for line in order_lines:
        product_id = line["product_id"]
        qty = Decimal(str(line.get("qty", "0")))
        bom = session.query(MrpBOM).filter(MrpBOM.product_id == product_id).one_or_none()
        if not bom:
            # treat product as atomic material itself
            required.setdefault(product_id, Decimal(0))
            required[product_id] += qty
            continue
        for item in bom.lines:
            mat_id = item.material_id
            mat_qty = Decimal(str(item.quantity))
            total = mat_qty * qty
            required.setdefault(mat_id, Decimal(0))
            required[mat_id] += total
    return required

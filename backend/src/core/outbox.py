from typing import Any
import sys
from ..models.outbox import OutboxEvent
from ..core.database import get_session


def save_outbox(session, aggregate_type: str, aggregate_id: str, event_type: str, payload: Any):
    """Add an OutboxEvent inside the same DB transaction.

    If a test has provided a `save_outbox` implementation on `src.modules.sales.router`,
    delegate to that to allow monkeypatching. Otherwise persist an OutboxEvent.
    """
    sales_router = sys.modules.get("src.modules.sales.router")
    if sales_router is not None and hasattr(sales_router, "save_outbox"):
        provider = getattr(sales_router, "save_outbox")
        if callable(provider):
            return provider(session=session, aggregate_type=aggregate_type, aggregate_id=aggregate_id, event_type=event_type, payload=payload)

    ev = OutboxEvent(
        aggregate_type=aggregate_type,
        aggregate_id=aggregate_id,
        event_type=event_type,
        payload=payload,
    )
    session.add(ev)
    return ev

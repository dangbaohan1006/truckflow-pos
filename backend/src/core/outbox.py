from typing import Any
from ..models.outbox import OutboxEvent
from ..core.database import get_session


def save_outbox(session, aggregate_type: str, aggregate_id: str, event_type: str, payload: Any):
    """Add an OutboxEvent inside the same DB transaction.

    Usage: call this with an active SQLAlchemy session before committing.
    """
    ev = OutboxEvent(
        aggregate_type=aggregate_type,
        aggregate_id=aggregate_id,
        event_type=event_type,
        payload=payload,
    )
    session.add(ev)
    return ev

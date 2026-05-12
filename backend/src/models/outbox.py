from sqlalchemy import Column, BigInteger, Text, Boolean, DateTime
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import JSONB
from ..core.database import Base


class OutboxEvent(Base):
    __tablename__ = "outbox_events"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    aggregate_type = Column(Text, nullable=False)
    aggregate_id = Column(Text, nullable=False)
    event_type = Column(Text, nullable=False)
    payload = Column(JSONB, nullable=False)
    processed = Column(Boolean, nullable=False, server_default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

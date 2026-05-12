from sqlalchemy import Column, String, Text, Numeric, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from src.core.database import Base

class PosOrder(Base):
    __tablename__ = "pos_order"

    id = Column(String, primary_key=True)
    total_amount = Column(Numeric(15, 4), nullable=False, default=0)
    status = Column(String, nullable=False, default='created')
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    lines = relationship("PosOrderLine", back_populates="order", cascade="all, delete-orphan")


class PosOrderLine(Base):
    __tablename__ = "pos_order_line"

    id = Column(String, primary_key=True)
    order_id = Column(String, ForeignKey("pos_order.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Text, nullable=False)
    quantity = Column(Numeric(15, 4), nullable=False)
    price = Column(Numeric(15, 4), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    order = relationship("PosOrder", back_populates="lines")

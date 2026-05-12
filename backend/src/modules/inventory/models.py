from sqlalchemy import Column, BigInteger, Integer, Text, DateTime, Boolean, func
from sqlalchemy import Numeric, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from src.core.database import Base
from decimal import Decimal


class MrpBOM(Base):
    __tablename__ = "mrp_bom"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    product_id = Column(Text, nullable=False, unique=True)  # finished product
    
    # Relationship to bom lines
    lines = relationship("MrpBOMLine", back_populates="bom", cascade="all, delete-orphan")


class MrpBOMLine(Base):
    __tablename__ = "mrp_bom_line"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    bom_id = Column(BigInteger, ForeignKey("mrp_bom.id", ondelete="CASCADE"), nullable=False)
    material_id = Column(Text, nullable=False)
    quantity = Column(Numeric(15,4), nullable=False)

    bom = relationship("MrpBOM", back_populates="lines")


class InventoryLevel(Base):
    __tablename__ = "inventory_levels"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    product_id = Column(Text, nullable=False, unique=True)
    quantity = Column(Numeric(15,4), nullable=False, server_default="0")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class StockMove(Base):
    __tablename__ = "stock_move"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    product_id = Column(Text, nullable=False)
    location_id = Column(Text, nullable=True)
    quantity = Column(Numeric(15,4), nullable=False)
    needs_audit = Column(Boolean, nullable=False, server_default="false")
    origin = Column(Text, nullable=True)  # e.g., order:1234
    meta = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

from sqlalchemy import Column, String, Text, Numeric, DateTime, func
from src.core.database import Base


class CustomerOrder(Base):
    __tablename__ = "customer_orders"

    id = Column(String, primary_key=True)
    table_number = Column(String, nullable=False, default="1")
    customer_name = Column(String, nullable=False, default="Khách")
    customer_phone = Column(String, nullable=True, default="")
    note = Column(Text, nullable=True, default="")
    status = Column(String, nullable=False, default='PENDING')  # PENDING → CONFIRMED → COMPLETED / CANCELLED
    truck_id = Column(String, nullable=True, default="")
    staff_note = Column(Text, nullable=True, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CustomerOrderItem(Base):
    __tablename__ = "customer_order_items"

    id = Column(String, primary_key=True)
    order_id = Column(String, nullable=False, index=True)
    menu_item_id = Column(String, nullable=False)
    product_name = Column(String, nullable=False)
    quantity = Column(Numeric(15, 4), nullable=False, default=1)
    price = Column(Numeric(15, 4), nullable=False, default=0)
    note = Column(Text, nullable=True, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class OrderNotification(Base):
    __tablename__ = "order_notifications"

    id = Column(String, primary_key=True)
    order_id = Column(String, nullable=False, index=True)
    type = Column(String, nullable=False)  # NEW_ORDER, CONFIRMED, UPDATED, CANCELLED
    message = Column(Text, nullable=True, default="")
    is_read = Column(String, nullable=False, default="false")  # "true" / "false"
    created_at = Column(DateTime(timezone=True), server_default=func.now())

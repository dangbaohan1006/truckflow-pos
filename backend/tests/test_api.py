import importlib
import sys
from datetime import datetime, timezone
from decimal import Decimal

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.core.database import Base
from src.modules.sales.models import PosOrder, PosOrderLine


@pytest.fixture()
def app(monkeypatch):
    monkeypatch.setattr(Base.metadata, "create_all", lambda *args, **kwargs: None)
    sys.modules.pop("src.main", None)
    module = importlib.import_module("src.main")
    return module.app


class FakeQuery:
    def __init__(self, session, model):
        self.session = session
        self.model = model
        self.criteria = {}

    def filter(self, *args, **kwargs):
        return self

    def filter_by(self, **kwargs):
        self.criteria.update(kwargs)
        return self

    def first(self):
        if self.model is PosOrder:
            order_id = self.criteria.get("id")
            if order_id is not None:
                return self.session.orders_by_id.get(order_id)
        if self.model is PosOrderLine:
            line_id = self.criteria.get("id")
            if line_id is not None:
                return self.session.lines_by_id.get(line_id)
        return None

    def all(self):
        if self.model is PosOrder and not self.criteria:
            return list(self.session.pull_orders)
        if self.model is PosOrderLine and not self.criteria:
            return list(self.session.pull_lines)
        if self.model is PosOrderLine:
            order_id = self.criteria.get("order_id")
            if order_id is not None:
                return list(self.session.lines_by_order_id.get(order_id, []))
        return []


class FakeSession:
    def __init__(self):
        self.orders_by_id = {}
        self.lines_by_id = {}
        self.lines_by_order_id = {}
        self.pull_orders = []
        self.pull_lines = []
        self.added_objects = []
        self.outbox_events = []
        self.committed = False
        self.rolled_back = False
        self.closed = False

    def query(self, model):
        return FakeQuery(self, model)

    def add(self, obj):
        self.added_objects.append(obj)
        if isinstance(obj, PosOrder):
            self.orders_by_id[obj.id] = obj
        elif isinstance(obj, PosOrderLine):
            self.lines_by_id[obj.id] = obj
            self.lines_by_order_id.setdefault(obj.order_id, []).append(obj)
        else:
            self.outbox_events.append(obj)

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True

    def close(self):
        self.closed = True


def test_health_check_returns_ok(app):
    client = TestClient(app)

    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "database": "Supabase Cloud Connection: Active",
        "sync_engine": "WatermelonDB Ready",
    }


def test_pull_sync_returns_updated_rows(monkeypatch):
    from src.modules.sales import router as sales_router

    session = FakeSession()
    session.pull_orders = [
        PosOrder(id="order-1", total_amount=Decimal("125.5000"), status="synced")
    ]
    session.pull_orders[0].updated_at = datetime(2026, 5, 11, 3, 30, tzinfo=timezone.utc)
    session.pull_lines = [
        PosOrderLine(
            id="line-1",
            order_id="order-1",
            product_id="coffee",
            quantity=Decimal("2.0000"),
            price=Decimal("62.7500"),
        )
    ]
    session.pull_lines[0].updated_at = datetime(2026, 5, 11, 3, 31, tzinfo=timezone.utc)

    monkeypatch.setattr(sales_router, "get_session", lambda: session)

    test_app = FastAPI()
    test_app.include_router(sales_router.router, prefix="/api/sales")
    client = TestClient(test_app)
    response = client.get("/api/sales/sync", params={"lastPulledAt": 1710000000000})

    assert response.status_code == 200
    body = response.json()
    assert body["changes"]["pos_order"]["updated"][0]["id"] == "order-1"
    assert body["changes"]["pos_order"]["updated"][0]["total_amount"] == "125.5000"
    assert body["changes"]["pos_order_line"]["updated"][0]["id"] == "line-1"
    assert body["changes"]["pos_order_line"]["updated"][0]["price"] == "62.7500"


def test_push_sync_inserts_order_line_and_outbox(monkeypatch):
    from src.modules.sales import router as sales_router

    session = FakeSession()
    saved_events = []

    def fake_save_outbox(*, session, aggregate_type, aggregate_id, event_type, payload):
        saved_events.append(
            {
                "session": session,
                "aggregate_type": aggregate_type,
                "aggregate_id": aggregate_id,
                "event_type": event_type,
                "payload": payload,
            }
        )
        return payload

    monkeypatch.setattr(sales_router, "get_session", lambda: session)
    monkeypatch.setattr(sales_router, "save_outbox", fake_save_outbox)

    test_app = FastAPI()
    test_app.include_router(sales_router.router, prefix="/api/sales")
    client = TestClient(test_app)
    response = client.post(
        "/api/sales/sync",
        json={
            "lastPulledAt": None,
            "changes": {
                "pos_order": {
                    "created": [
                        {
                            "id": "order-1",
                            "total_amount": "150.0000",
                            "status": "created",
                            "updated_at": 1715398200000,
                        }
                    ],
                    "updated": [],
                    "deleted": [],
                },
                "pos_order_line": {
                    "created": [
                        {
                            "id": "line-1",
                            "order_id": "order-1",
                            "product_id": "coffee",
                            "quantity": "2.0000",
                            "price": "75.0000",
                            "updated_at": 1715398200000,
                        }
                    ],
                    "updated": [],
                    "deleted": [],
                },
            },
        },
    )

    assert response.status_code == 200
    assert response.json() == {"success": True}
    assert session.committed is True
    assert session.closed is True
    assert "order-1" in session.orders_by_id
    assert "line-1" in session.lines_by_id
    assert len(saved_events) == 1
    assert saved_events[0]["aggregate_id"] == "order-1"
    assert saved_events[0]["payload"]["lines"] == [
        {"product_id": "coffee", "qty": "2.0000", "price": "75.0000"}
    ]

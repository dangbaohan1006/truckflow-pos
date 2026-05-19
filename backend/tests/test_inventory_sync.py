"""
Tests for the Inventory Sync Router (WatermelonDB protocol).

Uses the same FakeSession pattern as test_api.py to avoid needing a real database.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.modules.inventory.models import InventoryLevel, StockMove
from src.modules.inventory import sync_router


# ============================================================
# Fake Query / Session (same pattern as test_api.py)
# ============================================================

class FakeQuery:
    def __init__(self, session, model):
        self.session = session
        self.model = model
        self._filter_args = []
        self._filter_kwargs = {}

    def filter(self, *args, **kwargs):
        self._filter_args = list(args)
        self._filter_kwargs.update(kwargs)
        return self

    def filter_by(self, **kwargs):
        self._filter_kwargs.update(kwargs)
        return self

    def one_or_none(self):
        if self.model is InventoryLevel:
            product_id = self._filter_kwargs.get("product_id")
            if product_id is not None:
                return self.session.levels_by_id.get(product_id)
            # Handle filter(InventoryLevel.product_id == product_id)
            for arg in self._filter_args:
                if hasattr(arg, "left") and hasattr(arg.left, "key") and arg.left.key == "product_id":
                    if hasattr(arg, "right") and hasattr(arg.right, "value"):
                        return self.session.levels_by_id.get(arg.right.value)
        return None

    def all(self):
        if self.model is InventoryLevel:
            return list(self.session.pull_levels)
        if self.model is StockMove:
            return list(self.session.pull_moves)
        return []


class FakeSession:
    def __init__(self):
        self.levels_by_id: dict[str, InventoryLevel] = {}
        self.pull_levels: list[InventoryLevel] = []
        self.pull_moves: list[StockMove] = []
        self.added_objects: list = []
        self.outbox_events: list = []
        self.committed = False
        self.rolled_back = False
        self.closed = False

    def query(self, model):
        return FakeQuery(self, model)

    def add(self, obj):
        self.added_objects.append(obj)
        if isinstance(obj, InventoryLevel):
            self.levels_by_id[obj.product_id] = obj
        elif isinstance(obj, StockMove):
            pass  # stock moves are tracked via added_objects
        else:
            self.outbox_events.append(obj)

    def flush(self):
        pass

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True

    def close(self):
        self.closed = True


# ============================================================
# Fixtures
# ============================================================

@pytest.fixture()
def fake_session():
    return FakeSession()


@pytest.fixture()
def client(monkeypatch, fake_session):
    monkeypatch.setattr(sync_router, "get_session", lambda: fake_session)

    # Mock save_outbox to just record events
    saved_events = []

    def fake_save_outbox(*, session, aggregate_type, aggregate_id, event_type, payload):
        saved_events.append({
            "aggregate_type": aggregate_type,
            "aggregate_id": aggregate_id,
            "event_type": event_type,
            "payload": payload,
        })
        return payload

    monkeypatch.setattr(sync_router, "save_outbox", fake_save_outbox)

    test_app = FastAPI()
    test_app.include_router(sync_router.router)
    client = TestClient(test_app, base_url="http://testserver")
    client._saved_events = saved_events
    client._fake_session = fake_session
    return client


# ============================================================
# Tests
# ============================================================

class TestInventoryPullSync:
    def test_pull_with_no_last_pulled_at_returns_empty(self, client):
        """When lastPulledAt is None/0, return empty changes with a timestamp."""
        response = client.get("/api/inventory/sync", params={"lastPulledAt": 0})
        assert response.status_code == 200
        body = response.json()
        assert "changes" in body
        assert "timestamp" in body
        assert body["changes"]["inventory_items"]["created"] == []
        assert body["changes"]["inventory_items"]["updated"] == []
        assert body["changes"]["inventory_items"]["deleted"] == []
        assert body["changes"]["stock_movements"]["created"] == []
        assert body["changes"]["stock_movements"]["updated"] == []
        assert body["changes"]["stock_movements"]["deleted"] == []

    def test_pull_returns_updated_inventory_levels(self, client, fake_session):
        """Pull returns inventory levels updated after lastPulledAt."""
        level = InventoryLevel(product_id="coffee-beans", quantity=Decimal("50.0000"))
        level.updated_at = datetime(2026, 5, 15, 10, 0, tzinfo=timezone.utc)
        fake_session.pull_levels = [level]

        response = client.get("/api/inventory/sync", params={"lastPulledAt": 1710000000000})
        assert response.status_code == 200
        body = response.json()
        items = body["changes"]["inventory_items"]["updated"]
        assert len(items) == 1
        assert items[0]["sku"] == "coffee-beans"
        assert items[0]["quantity"] == "50.0000"

    def test_pull_returns_updated_stock_moves(self, client, fake_session):
        """Pull returns stock moves created after lastPulledAt."""
        move = StockMove(
            product_id="coffee-beans",
            quantity=Decimal("-5.0000"),
            origin="order:1234",
            meta={"note": "Sold 5 units", "move_type": "SALE"},
        )
        move.created_at = datetime(2026, 5, 15, 11, 0, tzinfo=timezone.utc)
        fake_session.pull_moves = [move]

        response = client.get("/api/inventory/sync", params={"lastPulledAt": 1710000000000})
        assert response.status_code == 200
        body = response.json()
        moves = body["changes"]["stock_movements"]["updated"]
        assert len(moves) == 1
        assert moves[0]["item_id"] == "coffee-beans"
        assert moves[0]["quantity"] == "-5.0000"
        assert moves[0]["type"] == "SALE"


class TestInventoryPushSync:
    def test_push_creates_new_inventory_level(self, client, fake_session):
        """Push creates a new inventory level when it doesn't exist."""
        response = client.post(
            "/api/inventory/sync",
            json={
                "lastPulledAt": None,
                "changes": {
                    "inventory_items": {
                        "created": [
                            {
                                "id": "inv_milk",
                                "sku": "milk",
                                "quantity": "100.0000",
                                "updated_at": 1715398200000,
                            }
                        ],
                        "updated": [],
                        "deleted": [],
                    },
                    "stock_movements": {
                        "created": [],
                        "updated": [],
                        "deleted": [],
                    },
                },
            },
        )
        assert response.status_code == 200
        assert response.json() == {"success": True}
        assert fake_session.committed is True
        assert fake_session.closed is True
        assert "milk" in fake_session.levels_by_id
        assert fake_session.levels_by_id["milk"].quantity == Decimal("100.0000")

    def test_push_updates_existing_inventory_level(self, client, fake_session):
        """Push updates an existing inventory level with newer timestamp."""
        existing = InventoryLevel(product_id="sugar", quantity=Decimal("50.0000"))
        existing.updated_at = datetime(2024, 1, 1, 0, 0, tzinfo=timezone.utc)
        fake_session.levels_by_id["sugar"] = existing

        response = client.post(
            "/api/inventory/sync",
            json={
                "lastPulledAt": None,
                "changes": {
                    "inventory_items": {
                        "created": [],
                        "updated": [
                            {
                                "id": "inv_sugar",
                                "sku": "sugar",
                                "quantity": "75.0000",
                                "updated_at": 1775000000000,  # ~April 2026
                            }
                        ],
                        "deleted": [],
                    },
                    "stock_movements": {
                        "created": [],
                        "updated": [],
                        "deleted": [],
                    },
                },
            },
        )
        assert response.status_code == 200
        assert fake_session.levels_by_id["sugar"].quantity == Decimal("75.0000")

    def test_push_creates_stock_move_and_updates_level(self, client, fake_session):
        """Push creates a stock movement and adjusts the inventory level."""
        existing = InventoryLevel(product_id="coffee", quantity=Decimal("100.0000"))
        fake_session.levels_by_id["coffee"] = existing

        response = client.post(
            "/api/inventory/sync",
            json={
                "lastPulledAt": None,
                "changes": {
                    "inventory_items": {
                        "created": [],
                        "updated": [],
                        "deleted": [],
                    },
                    "stock_movements": {
                        "created": [
                            {
                                "id": "move_001",
                                "item_id": "coffee",
                                "item_name": "Coffee Beans",
                                "quantity": "-10.0000",
                                "type": "SALE",
                                "reference_id": "order:456",
                                "note": "Sold 10 units",
                                "created_at": 1715398200000,
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
        # Level should be updated: 100 - 10 = 90
        assert fake_session.levels_by_id["coffee"].quantity == Decimal("90.0000")
        # Stock move should be added
        moves = [obj for obj in fake_session.added_objects if isinstance(obj, StockMove)]
        assert len(moves) == 1
        assert moves[0].product_id == "coffee"
        assert moves[0].quantity == Decimal("-10.0000")

    def test_push_creates_stock_move_and_creates_level(self, client, fake_session):
        """Push creates a stock movement and creates a new inventory level if missing."""
        response = client.post(
            "/api/inventory/sync",
            json={
                "lastPulledAt": None,
                "changes": {
                    "inventory_items": {
                        "created": [],
                        "updated": [],
                        "deleted": [],
                    },
                    "stock_movements": {
                        "created": [
                            {
                                "id": "move_002",
                                "item_id": "new-item",
                                "item_name": "New Item",
                                "quantity": "50.0000",
                                "type": "RECEIVE",
                                "reference_id": "receive:PO-001",
                                "note": "Initial stock",
                                "created_at": 1715398200000,
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
        assert "new-item" in fake_session.levels_by_id
        assert fake_session.levels_by_id["new-item"].quantity == Decimal("50.0000")

    def test_push_emits_outbox_events(self, client, fake_session):
        """Push emits outbox events for modified products."""
        response = client.post(
            "/api/inventory/sync",
            json={
                "lastPulledAt": None,
                "changes": {
                    "inventory_items": {
                        "created": [
                            {
                                "id": "inv_tea",
                                "sku": "tea",
                                "quantity": "30.0000",
                                "updated_at": 1715398200000,
                            }
                        ],
                        "updated": [],
                        "deleted": [],
                    },
                    "stock_movements": {
                        "created": [],
                        "updated": [],
                        "deleted": [],
                    },
                },
            },
        )
        assert response.status_code == 200
        # Check outbox events were recorded
        assert len(client._saved_events) >= 1
        event = client._saved_events[0]
        assert event["aggregate_type"] == "InventoryLevel"
        assert event["aggregate_id"] == "tea"
        assert event["event_type"] == "InventoryUpdated"
        assert event["payload"]["quantity"] == "30.0000"

    def test_push_handles_empty_changes_gracefully(self, client, fake_session):
        """Push with empty changes returns success."""
        response = client.post(
            "/api/inventory/sync",
            json={
                "lastPulledAt": None,
                "changes": {
                    "inventory_items": {
                        "created": [],
                        "updated": [],
                        "deleted": [],
                    },
                    "stock_movements": {
                        "created": [],
                        "updated": [],
                        "deleted": [],
                    },
                },
            },
        )
        assert response.status_code == 200
        assert response.json() == {"success": True}
        assert fake_session.committed is True


class TestMoveTypeFromOrigin:
    """Test the _move_type_from_origin helper."""

    def test_receive_origin(self):
        assert sync_router._move_type_from_origin("receive:PO-001") == "RECEIVE"

    def test_issue_origin(self):
        assert sync_router._move_type_from_origin("issue:spoilage") == "SPOILAGE"

    def test_spoilage_origin(self):
        assert sync_router._move_type_from_origin("spoilage:expired") == "SPOILAGE"

    def test_order_origin(self):
        assert sync_router._move_type_from_origin("order:1234") == "SALE"

    def test_adjust_origin(self):
        assert sync_router._move_type_from_origin("adjust:manual") == "ADJUSTMENT"

    def test_count_origin(self):
        assert sync_router._move_type_from_origin("count:inventory") == "ADJUSTMENT"

    def test_transfer_origin(self):
        assert sync_router._move_type_from_origin("transfer:truck-1") == "TRANSFER_OUT"

    def test_none_origin(self):
        assert sync_router._move_type_from_origin(None) == "ADJUSTMENT"

    def test_empty_origin(self):
        assert sync_router._move_type_from_origin("") == "ADJUSTMENT"

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import uuid4

from ...core.database import get_session
from ..inventory.bom_engine import compute_materials_for_order
from ..inventory.models import InventoryLevel, MrpBOM, StockMove
from .contracts import InventoryRepository

INVENTORY_HEADERS = ["id", "product_id", "quantity", "updated_at"]
STOCK_MOVE_HEADERS = ["id", "product_id", "location_id", "quantity", "needs_audit", "origin", "meta", "created_at"]
BOM_HEADERS = ["id", "product_id"]
BOM_LINE_HEADERS = ["id", "bom_id", "material_id", "quantity"]


def _now_ts() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def _load_google_client(spreadsheet_id: str | None):
    try:
        import gspread
        from google.oauth2.service_account import Credentials
    except ImportError as exc:
        raise RuntimeError("Install gspread and google-auth to use the Google Sheets inventory adapter.") from exc

    if not spreadsheet_id:
        raise RuntimeError("GOOGLE_SHEETS_SPREADSHEET_ID is required for the Google Sheets inventory adapter.")

    scopes = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]
    credentials_json = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON")
    credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

    if credentials_json:
        credentials = Credentials.from_service_account_info(json.loads(credentials_json), scopes=scopes)
    elif credentials_path:
        credentials = Credentials.from_service_account_file(credentials_path, scopes=scopes)
    else:
        raise RuntimeError("Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS for Sheets access.")

    client = gspread.authorize(credentials)
    return client.open_by_key(spreadsheet_id)


def _ensure_worksheet(sheet, title: str, headers: list[str]):
    try:
        ws = sheet.worksheet(title)
    except Exception:
        ws = sheet.add_worksheet(title=title, rows=1000, cols=max(len(headers), 10))
        ws.append_row(headers)
        return ws

    if not ws.row_values(1):
        ws.append_row(headers)
    return ws


def _find_row_by_id(worksheet, record_id: str) -> int | None:
    ids = worksheet.col_values(1)
    for index, value in enumerate(ids[1:], start=2):
        if value == str(record_id):
            return index
    return None


def _find_row_by_column(worksheet, column_name: str, value: str) -> int | None:
    headers = worksheet.row_values(1)
    try:
        column_index = headers.index(column_name) + 1
    except ValueError:
        return None

    values = worksheet.col_values(column_index)
    for index, cell_value in enumerate(values[1:], start=2):
        if cell_value == str(value):
            return index
    return None


def _update_or_append(worksheet, headers: list[str], record_id: str, record: dict[str, Any]) -> None:
    row_index = _find_row_by_id(worksheet, record_id)
    values = [str(record.get(header, "")) for header in headers]
    if row_index is not None:
        worksheet.update(f"A{row_index}", [values])
        return
    worksheet.append_row(values)


class GoogleSheetsInventoryRepository(InventoryRepository):
    def __init__(self, spreadsheet_id: str | None = None) -> None:
        self.spreadsheet_id = spreadsheet_id
        self._sheet = None

    def _sheet_client(self):
        if self._sheet is None:
            self._sheet = _load_google_client(self.spreadsheet_id)
        return self._sheet

    def _worksheet(self, title: str, headers: list[str]):
        return _ensure_worksheet(self._sheet_client(), title, headers)

    def _apply_inventory_row(
        self,
        worksheet,
        product_id: str,
        delta: Decimal,
        operation: str,
        location_id: str | None,
        reference: str | None,
        note: str | None,
        actor_id: str | None,
        existing_row: dict[str, Any] | None = None,
        row_index: int | None = None,
        current_qty: Decimal | None = None,
    ) -> dict[str, Any]:
        if existing_row is None:
            current_rows = worksheet.get_all_records()
            existing_row_index = _find_row_by_column(worksheet, "product_id", product_id)
            if existing_row_index is not None:
                matches = [row for row in current_rows if str(row.get("product_id")) == product_id]
                if matches:
                    existing_row = matches[0]
                    row_index = existing_row_index

        if current_qty is None:
            current_qty = Decimal(str(existing_row.get("quantity", "0"))) if existing_row else Decimal("0")

        new_qty = current_qty + delta
        needs_audit = new_qty < 0

        inventory_record = {
            "id": existing_row.get("id") if existing_row else str(uuid4()),
            "product_id": product_id,
            "quantity": str(new_qty),
            "updated_at": _now_ts(),
        }
        if row_index is not None:
            worksheet.update(
                f"A{row_index}",
                [[str(inventory_record.get(header, "")) for header in INVENTORY_HEADERS]],
            )
        else:
            worksheet.append_row([str(inventory_record.get(header, "")) for header in INVENTORY_HEADERS])

        move_record = {
            "id": str(uuid4()),
            "product_id": product_id,
            "location_id": location_id,
            "quantity": str(delta),
            "needs_audit": str(needs_audit).lower(),
            "origin": f"{operation}:{reference}" if reference else operation,
            "meta": json.dumps(
                {
                    "operation": operation,
                    "reference": reference,
                    "note": note,
                    "actor_id": actor_id,
                    "current_quantity": str(current_qty),
                    "new_quantity": str(new_qty),
                },
                ensure_ascii=False,
            ),
            "created_at": _now_ts(),
        }
        stock_move_ws = self._worksheet("stock_move", STOCK_MOVE_HEADERS)
        _update_or_append(stock_move_ws, STOCK_MOVE_HEADERS, move_record["id"], move_record)
        return move_record

    def apply_inventory_operation(
        self,
        operation: str,
        items: list[dict[str, Any]],
        location_id: str | None = None,
        reference: str | None = None,
        note: str | None = None,
        actor_id: str | None = None,
    ) -> list[dict[str, Any]]:
        inventory_ws = self._worksheet("inventory_levels", INVENTORY_HEADERS)
        moves: list[dict[str, Any]] = []
        inventory_state: dict[str, dict[str, Any]] = {
            str(row.get("product_id")): row for row in inventory_ws.get_all_records()
        }

        for item in items:
            product_id = str(item.get("product_id"))
            if not product_id:
                continue

            if operation == "receive":
                delta = Decimal(str(item.get("quantity", "0")))
            elif operation == "issue":
                delta = -Decimal(str(item.get("quantity", "0")))
            elif operation == "count":
                target_qty = Decimal(str(item.get("counted_quantity", item.get("quantity", "0"))))
                existing_row_index = _find_row_by_column(inventory_ws, "product_id", product_id)
                current_rows = inventory_ws.get_all_records()
                existing_row = None
                if existing_row_index is not None:
                    matches = [row for row in current_rows if str(row.get("product_id")) == product_id]
                    if matches:
                        existing_row = matches[0]
                current_qty = Decimal(str(existing_row.get("quantity", "0"))) if existing_row else Decimal("0")
                delta = target_qty - current_qty
            elif operation == "adjust":
                delta = Decimal(str(item.get("delta_quantity", item.get("quantity", "0"))))
            else:
                raise ValueError(f"Unsupported inventory operation: {operation}")

            existing_row = inventory_state.get(product_id)
            current_qty = Decimal(str(existing_row.get("quantity", "0"))) if existing_row else Decimal("0")
            row_index = _find_row_by_column(inventory_ws, "product_id", product_id)
            inventory_state[product_id] = {
                "id": existing_row.get("id") if existing_row else str(uuid4()),
                "product_id": product_id,
                "quantity": str(current_qty + delta),
                "updated_at": _now_ts(),
            }

            moves.append(
                self._apply_inventory_row(
                    inventory_ws,
                    product_id=product_id,
                    delta=delta,
                    operation=operation,
                    location_id=location_id,
                    reference=reference,
                    note=note,
                    actor_id=actor_id,
                    existing_row=existing_row,
                    row_index=row_index,
                    current_qty=current_qty,
                )
            )

        return moves

    def _load_bom_maps(self) -> dict[str, list[dict[str, Any]]]:
        bom_ws = self._worksheet("mrp_bom", BOM_HEADERS)
        line_ws = self._worksheet("mrp_bom_line", BOM_LINE_HEADERS)

        bom_rows = bom_ws.get_all_records()
        line_rows = line_ws.get_all_records()

        bom_lookup: dict[str, list[dict[str, Any]]] = {}
        bom_id_to_product: dict[str, str] = {}
        for row in bom_rows:
            bom_id = str(row.get("id"))
            product_id = str(row.get("product_id"))
            if bom_id and product_id:
                bom_id_to_product[bom_id] = product_id
                bom_lookup.setdefault(product_id, [])

        for row in line_rows:
            bom_id = str(row.get("bom_id"))
            product_id = bom_id_to_product.get(bom_id)
            if not product_id:
                continue
            bom_lookup.setdefault(product_id, []).append(
                {
                    "material_id": str(row.get("material_id")),
                    "quantity": Decimal(str(row.get("quantity", "0"))),
                }
            )

        return bom_lookup

    def apply_materials_from_order(
        self,
        order_id: str,
        order_lines: list[dict[str, Any]],
        location_id: str | None = None,
    ) -> list[dict[str, Any]]:
        materials_required: dict[str, Decimal] = {}
        bom_lookup = self._load_bom_maps()

        for line in order_lines:
            product_id = str(line.get("product_id"))
            qty = Decimal(str(line.get("qty", line.get("quantity", "0"))))
            bom_lines = bom_lookup.get(product_id)
            if not bom_lines:
                materials_required[product_id] = materials_required.get(product_id, Decimal("0")) + qty
                continue
            for bom_line in bom_lines:
                material_id = str(bom_line["material_id"])
                total = Decimal(str(bom_line["quantity"])) * qty
                materials_required[material_id] = materials_required.get(material_id, Decimal("0")) + total

        inventory_ws = self._worksheet("inventory_levels", INVENTORY_HEADERS)
        stock_move_ws = self._worksheet("stock_move", STOCK_MOVE_HEADERS)
        moves: list[dict[str, Any]] = []

        current_rows = inventory_ws.get_all_records()

        for material_id, qty in materials_required.items():
            existing_row_index = _find_row_by_column(inventory_ws, "product_id", material_id)
            existing_row = None
            if existing_row_index is not None:
                matching_rows = [row for row in current_rows if str(row.get("product_id")) == material_id]
                if matching_rows:
                    existing_row = matching_rows[0]

            existing_quantity = Decimal(str(existing_row.get("quantity", "0"))) if existing_row else Decimal("0")

            new_qty = existing_quantity - Decimal(qty)
            needs_audit = new_qty < 0

            inventory_record = {
                "id": existing_row.get("id") if existing_row else str(uuid4()),
                "product_id": material_id,
                "quantity": str(new_qty),
                "updated_at": _now_ts(),
            }
            if existing_row_index is not None:
                inventory_ws.update(
                    f"A{existing_row_index}",
                    [[str(inventory_record.get(header, "")) for header in INVENTORY_HEADERS]],
                )
            else:
                inventory_ws.append_row([str(inventory_record.get(header, "")) for header in INVENTORY_HEADERS])

            move_record = {
                "id": str(uuid4()),
                "product_id": material_id,
                "location_id": location_id,
                "quantity": str(-Decimal(qty)),
                "needs_audit": str(needs_audit).lower(),
                "origin": f"order:{order_id}",
                "meta": json.dumps({"source": "order", "order_id": order_id}, ensure_ascii=False),
                "created_at": _now_ts(),
            }
            _update_or_append(stock_move_ws, STOCK_MOVE_HEADERS, move_record["id"], move_record)
            moves.append(move_record)

        return moves


class PostgresInventoryRepository(InventoryRepository):
    def apply_inventory_operation(
        self,
        operation: str,
        items: list[dict[str, Any]],
        location_id: str | None = None,
        reference: str | None = None,
        note: str | None = None,
        actor_id: str | None = None,
    ) -> list[dict[str, Any]]:
        session = get_session()
        try:
            moves: list[dict[str, Any]] = []

            for item in items:
                product_id = str(item.get("product_id"))
                if not product_id:
                    continue

                inv = session.query(InventoryLevel).filter(InventoryLevel.product_id == product_id).one_or_none()
                if not inv:
                    inv = InventoryLevel(product_id=product_id, quantity=Decimal("0"))
                    session.add(inv)
                    session.flush()

                current_qty = Decimal(inv.quantity)
                if operation == "receive":
                    delta = Decimal(str(item.get("quantity", "0")))
                elif operation == "issue":
                    delta = -Decimal(str(item.get("quantity", "0")))
                elif operation == "count":
                    target_qty = Decimal(str(item.get("counted_quantity", item.get("quantity", "0"))))
                    delta = target_qty - current_qty
                elif operation == "adjust":
                    delta = Decimal(str(item.get("delta_quantity", item.get("quantity", "0"))))
                else:
                    raise ValueError(f"Unsupported inventory operation: {operation}")

                new_qty = current_qty + delta
                needs_audit = new_qty < 0

                move = StockMove(
                    product_id=product_id,
                    location_id=location_id,
                    quantity=delta,
                    needs_audit=needs_audit,
                    origin=f"{operation}:{reference}" if reference else operation,
                    meta={
                        "operation": operation,
                        "reference": reference,
                        "note": note,
                        "actor_id": actor_id,
                        "current_quantity": str(current_qty),
                        "new_quantity": str(new_qty),
                    },
                )
                session.add(move)
                inv.quantity = new_qty
                moves.append(
                    {
                        "product_id": product_id,
                        "location_id": location_id,
                        "quantity": str(delta),
                        "needs_audit": needs_audit,
                        "origin": move.origin,
                        "meta": move.meta,
                    }
                )

            session.commit()
            return moves
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def apply_materials_from_order(
        self,
        order_id: str,
        order_lines: list[dict[str, Any]],
        location_id: str | None = None,
    ) -> list[dict[str, Any]]:
        session = get_session()
        try:
            materials = compute_materials_for_order(session, order_lines)
            moves = []
            for material_id, qty in materials.items():
                inv = session.query(InventoryLevel).filter(InventoryLevel.product_id == material_id).one_or_none()
                if not inv:
                    inv = InventoryLevel(product_id=material_id, quantity=Decimal("0"))
                    session.add(inv)
                    session.flush()

                new_qty = Decimal(inv.quantity) - Decimal(qty)
                needs_audit = new_qty < 0

                move = StockMove(
                    product_id=material_id,
                    location_id=location_id,
                    quantity=-Decimal(qty),
                    needs_audit=needs_audit,
                    origin=f"order:{order_id}",
                )
                session.add(move)
                inv.quantity = new_qty
                moves.append(
                    {
                        "product_id": material_id,
                        "location_id": location_id,
                        "quantity": str(-Decimal(qty)),
                        "needs_audit": needs_audit,
                        "origin": f"order:{order_id}",
                    }
                )

            session.commit()
            return moves
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()
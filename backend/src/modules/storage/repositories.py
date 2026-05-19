from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from ...core.database import get_session
from ...core.outbox import save_outbox
from ..sales.models import PosOrder, PosOrderLine
from .contracts import SalesRepository

ORDER_HEADERS = ["id", "total_amount", "status", "created_at", "updated_at"]
LINE_HEADERS = ["id", "order_id", "product_id", "quantity", "price", "created_at", "updated_at"]
OUTBOX_HEADERS = ["aggregate_type", "aggregate_id", "event_type", "payload", "processed", "created_at"]


def _now_ts() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def _to_ms(value: datetime | None) -> int:
    return _now_ts() if value is None else int(value.timestamp() * 1000)


def _to_dt(value: int | None) -> datetime:
    if value is None:
        return datetime.now(timezone.utc)
    return datetime.fromtimestamp(value / 1000.0, tz=timezone.utc)


def _parse_ms(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _row_dict(worksheet, row_number: int) -> dict[str, Any]:
    headers = worksheet.row_values(1)
    values = worksheet.row_values(row_number)
    return {header: values[index] if index < len(values) else "" for index, header in enumerate(headers)}


def _upsert_row(worksheet, headers: list[str], key_value: str, record: dict[str, Any]) -> None:
    existing_rows = worksheet.col_values(1)
    row_index = None
    for index, value in enumerate(existing_rows[1:], start=2):
        if value == str(key_value):
            row_index = index
            break

    if row_index is not None:
        current = _row_dict(worksheet, row_index)
        current.update({key: value for key, value in record.items() if value is not None})
        worksheet.update(f"A{row_index}", [[str(current.get(header, "")) for header in headers]])
        return

    worksheet.append_row([str(record.get(header, "")) for header in headers])


class _GoogleSheetsClient:
    def __init__(self, spreadsheet_id: str | None) -> None:
        self.spreadsheet_id = spreadsheet_id
        self._client = None
        self._spreadsheet = None

    def _authorize(self):
        if self._client is not None:
            return self._client

        try:
            import gspread
            from google.oauth2.service_account import Credentials
        except ImportError as exc:
            raise RuntimeError("Install gspread and google-auth to use the Google Sheets adapter.") from exc

        scopes = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]
        credentials_json = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON")
        credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

        if credentials_json:
            credentials = Credentials.from_service_account_info(json.loads(credentials_json), scopes=scopes)
        elif credentials_path:
            credentials = Credentials.from_service_account_file(credentials_path, scopes=scopes)
        else:
            raise RuntimeError("Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS for Sheets access.")

        self._client = gspread.authorize(credentials)
        return self._client

    def spreadsheet(self):
        if self._spreadsheet is not None:
            return self._spreadsheet
        if not self.spreadsheet_id:
            raise RuntimeError("GOOGLE_SHEETS_SPREADSHEET_ID is required for the Google Sheets adapter.")
        self._spreadsheet = self._authorize().open_by_key(self.spreadsheet_id)
        return self._spreadsheet

    def worksheet(self, title: str, headers: list[str]):
        sheet = self.spreadsheet()
        try:
            ws = sheet.worksheet(title)
        except Exception:
            ws = sheet.add_worksheet(title=title, rows=1000, cols=max(len(headers), 10))
            ws.append_row(headers)
            return ws

        if not ws.row_values(1):
            ws.append_row(headers)
        return ws


class GoogleSheetsSalesRepository(SalesRepository):
    def __init__(self, spreadsheet_id: str | None = None) -> None:
        self.client = _GoogleSheetsClient(spreadsheet_id)

    def pull_sync(self, last_pulled_at: int | None = None) -> dict[str, Any]:
        now_ts = _now_ts()
        pull_changes = {
            "pos_order": {"created": [], "updated": [], "deleted": []},
            "pos_order_line": {"created": [], "updated": [], "deleted": []},
        }

        if last_pulled_at is None:
            return {"changes": pull_changes, "timestamp": now_ts}

        orders_ws = self.client.worksheet("pos_order", ORDER_HEADERS)
        lines_ws = self.client.worksheet("pos_order_line", LINE_HEADERS)

        for row in orders_ws.get_all_records():
            updated_at = _parse_ms(row.get("updated_at"))
            if updated_at is not None and updated_at > last_pulled_at:
                pull_changes["pos_order"]["updated"].append(
                    {
                        "id": row.get("id"),
                        "total_amount": str(row.get("total_amount", "0")),
                        "status": row.get("status", "created"),
                        "updated_at": updated_at,
                    }
                )

        for row in lines_ws.get_all_records():
            updated_at = _parse_ms(row.get("updated_at"))
            if updated_at is not None and updated_at > last_pulled_at:
                pull_changes["pos_order_line"]["updated"].append(
                    {
                        "id": row.get("id"),
                        "order_id": row.get("order_id"),
                        "product_id": row.get("product_id"),
                        "quantity": str(row.get("quantity", "0")),
                        "price": str(row.get("price", "0")),
                        "updated_at": updated_at,
                    }
                )

        return {"changes": pull_changes, "timestamp": now_ts}

    def push_sync(self, payload: dict[str, Any]) -> dict[str, Any]:
        orders_ws = self.client.worksheet("pos_order", ORDER_HEADERS)
        lines_ws = self.client.worksheet("pos_order_line", LINE_HEADERS)
        outbox_ws = self.client.worksheet("outbox_events", OUTBOX_HEADERS)

        modified_order_ids: set[str] = set()
        changes = payload.get("changes", {})
        orders_block = changes.get("pos_order", {})
        lines_block = changes.get("pos_order_line", {})

        for order_data in orders_block.get("created", []) + orders_block.get("updated", []):
            order_id = str(order_data.get("id"))
            record = {
                "id": order_id,
                "total_amount": str(order_data.get("total_amount", "0")),
                "status": order_data.get("status") or "created",
                "created_at": _now_ts(),
                "updated_at": order_data.get("updated_at") or _now_ts(),
            }
            _upsert_row(orders_ws, ORDER_HEADERS, order_id, record)
            modified_order_ids.add(order_id)

        for line_data in lines_block.get("created", []) + lines_block.get("updated", []):
            line_id = str(line_data.get("id"))
            order_id = str(line_data.get("order_id"))
            record = {
                "id": line_id,
                "order_id": order_id,
                "product_id": line_data.get("product_id"),
                "quantity": str(line_data.get("quantity", "0")),
                "price": str(line_data.get("price", "0")),
                "created_at": _now_ts(),
                "updated_at": line_data.get("updated_at") or _now_ts(),
            }
            _upsert_row(lines_ws, LINE_HEADERS, line_id, record)
            modified_order_ids.add(order_id)

        current_orders = orders_ws.get_all_records()
        current_lines = lines_ws.get_all_records()

        for order_id in modified_order_ids:
            order_rows = [row for row in current_orders if str(row.get("id")) == order_id]
            if not order_rows:
                continue
            order_row = order_rows[0]
            order_lines = [row for row in current_lines if str(row.get("order_id")) == order_id]
            payload_json = json.dumps(
                {
                    "id": order_id,
                    "total_amount": str(order_row.get("total_amount", "0")),
                    "lines": [
                        {
                            "product_id": row.get("product_id"),
                            "qty": str(row.get("quantity", "0")),
                            "price": str(row.get("price", "0")),
                        }
                        for row in order_lines
                    ],
                },
                ensure_ascii=False,
            )
            outbox_ws.append_row([
                "PosOrder",
                order_id,
                "OrderUpdated",
                payload_json,
                "false",
                str(_now_ts()),
            ])

        return {"success": True}


class PostgresSalesRepository(SalesRepository):
    def pull_sync(self, last_pulled_at: int | None = None) -> dict[str, Any]:
        session = get_session()
        try:
            pull_changes = {
                "pos_order": {"created": [], "updated": [], "deleted": []},
                "pos_order_line": {"created": [], "updated": [], "deleted": []},
            }
            now_ts = _now_ts()

            if last_pulled_at is not None:
                last_pulled_dt = datetime.fromtimestamp(last_pulled_at / 1000.0, tz=timezone.utc)

                updated_orders = session.query(PosOrder).filter(PosOrder.updated_at > last_pulled_dt).all()
                for order in updated_orders:
                    pull_changes["pos_order"]["updated"].append(
                        {
                            "id": order.id,
                            "total_amount": str(order.total_amount),
                            "status": order.status,
                            "updated_at": _to_ms(order.updated_at),
                        }
                    )

                updated_lines = session.query(PosOrderLine).filter(PosOrderLine.updated_at > last_pulled_dt).all()
                for line in updated_lines:
                    pull_changes["pos_order_line"]["updated"].append(
                        {
                            "id": line.id,
                            "order_id": line.order_id,
                            "product_id": line.product_id,
                            "quantity": str(line.quantity),
                            "price": str(line.price),
                            "updated_at": _to_ms(line.updated_at),
                        }
                    )

            return {"changes": pull_changes, "timestamp": now_ts}
        finally:
            session.close()

    def push_sync(self, payload: dict[str, Any]) -> dict[str, Any]:
        session = get_session()
        try:
            modified_order_ids: set[str] = set()
            changes = payload.get("changes", {})
            orders_block = changes.get("pos_order", {})
            lines_block = changes.get("pos_order_line", {})

            for order_data in orders_block.get("created", []) + orders_block.get("updated", []):
                order_id = str(order_data.get("id"))
                device_time = _to_dt(order_data.get("updated_at"))
                order = session.query(PosOrder).filter_by(id=order_id).first()
                if order:
                    if not order.updated_at or device_time > order.updated_at:
                        order.total_amount = Decimal(order_data.get("total_amount", "0"))
                        if order_data.get("status"):
                            order.status = order_data["status"]
                        if order_data.get("updated_at"):
                            order.updated_at = device_time
                else:
                    order = PosOrder(
                        id=order_id,
                        total_amount=Decimal(order_data.get("total_amount", "0")),
                        status=order_data.get("status") or "created",
                    )
                    if order_data.get("updated_at"):
                        order.updated_at = device_time
                    session.add(order)
                modified_order_ids.add(order.id)

            for line_data in lines_block.get("created", []) + lines_block.get("updated", []):
                line_id = str(line_data.get("id"))
                device_time = _to_dt(line_data.get("updated_at"))
                line = session.query(PosOrderLine).filter_by(id=line_id).first()
                if line:
                    if not line.updated_at or device_time > line.updated_at:
                        line.quantity = Decimal(line_data.get("quantity", "0"))
                        line.price = Decimal(line_data.get("price", "0"))
                        if line_data.get("updated_at"):
                            line.updated_at = device_time
                else:
                    line = PosOrderLine(
                        id=line_id,
                        order_id=str(line_data.get("order_id")),
                        product_id=str(line_data.get("product_id")),
                        quantity=Decimal(line_data.get("quantity", "0")),
                        price=Decimal(line_data.get("price", "0")),
                    )
                    if line_data.get("updated_at"):
                        line.updated_at = device_time
                    session.add(line)
                modified_order_ids.add(line.order_id)

            for order_id in modified_order_ids:
                order = session.query(PosOrder).filter_by(id=order_id).first()
                if not order:
                    continue

                lines = session.query(PosOrderLine).filter_by(order_id=order_id).all()
                lines_payload = [
                    {"product_id": line.product_id, "qty": str(line.quantity), "price": str(line.price)}
                    for line in lines
                ]

                save_outbox(
                    session=session,
                    aggregate_type="PosOrder",
                    aggregate_id=order.id,
                    event_type="OrderUpdated",
                    payload={"id": order.id, "total_amount": str(order.total_amount), "lines": lines_payload},
                )

            session.commit()
            return {"success": True}
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

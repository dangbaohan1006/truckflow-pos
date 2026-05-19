from __future__ import annotations

import os

from .contracts import StorageBackend
from .repositories import GoogleSheetsSalesRepository, PostgresSalesRepository
from .inventory_repositories import GoogleSheetsInventoryRepository, PostgresInventoryRepository
from .services import InventoryService, SalesSyncService


def get_storage_backend() -> StorageBackend:
    raw_value = os.getenv("STORAGE_BACKEND")
    if raw_value:
        try:
            return StorageBackend(raw_value)
        except ValueError:
            return StorageBackend.POSTGRES

    has_google_credentials = bool(
        os.getenv("GOOGLE_SHEETS_SPREADSHEET_ID")
        and (os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON") or os.getenv("GOOGLE_APPLICATION_CREDENTIALS"))
    )
    if has_google_credentials:
        return StorageBackend.GOOGLE_SHEETS

    return StorageBackend.POSTGRES


def build_sales_repository():
    backend = get_storage_backend()
    if backend is StorageBackend.POSTGRES:
        return PostgresSalesRepository()

    spreadsheet_id = os.getenv("GOOGLE_SHEETS_SPREADSHEET_ID")
    return GoogleSheetsSalesRepository(spreadsheet_id=spreadsheet_id)


def build_sales_service() -> SalesSyncService:
    return SalesSyncService(repository=build_sales_repository())


def build_inventory_repository():
    backend = get_storage_backend()
    if backend is StorageBackend.POSTGRES:
        return PostgresInventoryRepository()

    spreadsheet_id = os.getenv("GOOGLE_SHEETS_SPREADSHEET_ID")
    return GoogleSheetsInventoryRepository(spreadsheet_id=spreadsheet_id)


def build_inventory_service() -> InventoryService:
    return InventoryService(repository=build_inventory_repository())

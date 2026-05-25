"""Compatibility shim: expose permissions under src.modules.auth.permissions
This file forwards to the canonical src.auth.permissions module used elsewhere.
"""
from src.auth.permissions import PERMISSIONS, ROLES, ROLE_PERMISSIONS

__all__ = ["PERMISSIONS", "ROLES", "ROLE_PERMISSIONS"]

"""
FastAPI Dependencies for JWT Authentication.

Provides:
  - get_current_user: Extracts and verifies the access token from Authorization header.
  - require_role: Role-based access control.
  - require_permission: Permission-based access control.
"""

import time
from typing import List, Optional, Callable
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from .jwt_utils import decode_access_token
from .blacklist import is_access_token_blacklisted, is_user_blacklisted, get_token_remaining_ttl

# FastAPI security scheme for Bearer token
bearer_scheme = HTTPBearer(auto_error=False)


class AuthUser:
    """Represents an authenticated user extracted from JWT."""

    def __init__(self, payload: dict):
        self.id: str = payload.get("sub", "")
        self.role: str = payload.get("role", "")
        self.jti: str = payload.get("jti", "")
        self.token_payload: dict = payload

    @property
    def is_authenticated(self) -> bool:
        return bool(self.id)

    def __repr__(self) -> str:
        return f"AuthUser(id={self.id}, role={self.role})"


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> AuthUser:
    """Extract and verify the current user from the JWT access token.

    This dependency:
      1. Extracts the Bearer token from the Authorization header.
      2. Verifies the JWT signature and expiration.
      3. Checks the Redis blacklist for token revocation.
      4. Checks for user-level global blacklist.

    Returns:
        AuthUser object with user info.

    Raises:
        HTTPException 401: If token is missing, invalid, expired, or revoked.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    try:
        payload = decode_access_token(token)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check token-level blacklist
    jti = payload.get("jti", "")
    if jti and is_access_token_blacklisted(jti):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check user-level blacklist (force logout all sessions)
    user_id = payload.get("sub", "")
    if user_id and is_user_blacklisted(user_id):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User session has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return AuthUser(payload)


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> Optional[AuthUser]:
    """Like get_current_user but returns None instead of raising 401.

    Use this for endpoints that work both authenticated and unauthenticated.
    """
    if credentials is None:
        return None

    token = credentials.credentials
    try:
        payload = decode_access_token(token)
    except Exception:
        return None

    jti = payload.get("jti", "")
    if jti and is_access_token_blacklisted(jti):
        return None

    user_id = payload.get("sub", "")
    if user_id and is_user_blacklisted(user_id):
        return None

    return AuthUser(payload)


# ---------------------------------------------------------------------------
# Role-based Access Control
# ---------------------------------------------------------------------------
def require_role(*roles: str) -> Callable:
    """Dependency factory: require the user to have one of the specified roles.

    Usage:
        @router.get("/admin")
        async def admin_endpoint(user: AuthUser = Depends(require_role("SYSTEM_ADMIN", "STORE_MANAGER"))):
            ...
    """
    async def role_checker(current_user: AuthUser = Depends(get_current_user)) -> AuthUser:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of these roles: {', '.join(roles)}",
            )
        return current_user

    return role_checker


# ---------------------------------------------------------------------------
# Simple permission check (can be extended with a permission registry)
# ---------------------------------------------------------------------------
def require_permission(permission: str) -> Callable:
    """Dependency factory: require the user to have a specific permission.

    Note: This is a simplified version. In production, you'd load permissions
    from a database or a permission registry.

    Usage:
        @router.get("/sales")
        async def sales_endpoint(user: AuthUser = Depends(require_permission("sales:create"))):
            ...
    """
    async def permission_checker(current_user: AuthUser = Depends(get_current_user)) -> AuthUser:
        # SYSTEM_ADMIN role has all permissions
        if current_user.role == "SYSTEM_ADMIN":
            return current_user

        # For now, we check role-based permissions from the token payload
        # In a full implementation, permissions would be embedded in the token
        # or fetched from a database
        token_permissions = current_user.token_payload.get("permissions", [])
        if permission not in token_permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required permission: {permission}",
            )
        return current_user

    return permission_checker

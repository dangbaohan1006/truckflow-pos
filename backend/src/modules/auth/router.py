"""
Auth Router — JWT Authentication Endpoints.

Endpoints:
  POST /api/auth/login       — Authenticate user, return access + refresh tokens
  POST /api/auth/refresh     — Refresh an expired access token using a refresh token
  POST /api/auth/logout      — Revoke the current access token (add to blacklist)
  POST /api/auth/logout/all  — Revoke ALL tokens for the current user
  GET  /api/auth/me          — Get current user profile from access token
  GET  /api/auth/.well-known/jwks.json — JWKS endpoint for public key distribution
"""

import time
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Body
from pydantic import BaseModel, Field

from ...core.database import get_session
from .jwt_utils import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
    get_jwks,
)
from .blacklist import (
    blacklist_access_token,
    blacklist_refresh_token,
    blacklist_user_all_tokens,
    get_token_remaining_ttl,
)
from .dependencies import get_current_user, get_optional_user, AuthUser

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------
class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=1, max_length=255)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class RefreshRequest(BaseModel):
    refresh_token: str = Field(..., min_length=1)


class UserProfile(BaseModel):
    id: str
    username: str
    display_name: str
    role: str
    permissions: list


class LogoutResponse(BaseModel):
    message: str


# ---------------------------------------------------------------------------
# Helper: Build user profile from DB record
# ---------------------------------------------------------------------------
def _build_user_profile(db_user) -> dict:
    """Build a user profile dict from a database user record."""
    from src.auth.permissions import ROLE_PERMISSIONS

    role = db_user.role
    permissions = ROLE_PERMISSIONS.get(role, [])
    return {
        "id": db_user.id,
        "username": db_user.username,
        "display_name": db_user.displayName,
        "role": role,
        "permissions": permissions,
    }


# ---------------------------------------------------------------------------
# POST /api/auth/login
# ---------------------------------------------------------------------------
@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    """Authenticate user with username/password and return JWT tokens.

    Uses the local WatermelonDB users table (via PostgreSQL sync table).
    In production, passwords should be hashed with bcrypt/argon2.
    """
    session = get_session()
    try:
        # Query user from the database
        # Note: The users table is synced from WatermelonDB to PostgreSQL
        from src.modules.sales.models import PosOrder  # noqa: F401
        from sqlalchemy import text

        result = session.execute(
            text("SELECT id, username, password, display_name, role, status FROM users WHERE username = :username"),
            {"username": request.username},
        ).fetchone()

        if not result:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Sai tên đăng nhập hoặc mật khẩu",
            )

        user_id, username, password_hash, display_name, role, status = result

        # Check account status
        if status != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tài khoản đã bị khóa",
            )

        # Verify password (plain text for now — should migrate to bcrypt)
        if password_hash != request.password:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Sai tên đăng nhập hoặc mật khẩu",
            )

        # Build permissions list
        from src.auth.permissions import ROLE_PERMISSIONS
        permissions = ROLE_PERMISSIONS.get(role, [])

        # Create tokens
        access_token = create_access_token(
            subject=user_id,
            role=role,
            extra_claims={
                "username": username,
                "display_name": display_name,
                "permissions": permissions,
            },
        )
        refresh_token = create_refresh_token(subject=user_id)

        # Calculate expires_in from access token TTL
        from .jwt_utils import ACCESS_TOKEN_TTL_MINUTES
        expires_in = ACCESS_TOKEN_TTL_MINUTES * 60

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=expires_in,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login failed: {str(e)}",
        )
    finally:
        session.close()


# ---------------------------------------------------------------------------
# POST /api/auth/refresh
# ---------------------------------------------------------------------------
@router.post("/refresh", response_model=TokenResponse)
async def refresh(request: RefreshRequest):
    """Exchange a valid refresh token for a new access token (and new refresh token).

    Implements Refresh Token Rotation:
      - The old refresh token is blacklisted immediately.
      - A new refresh token is issued (rotation).
      - This prevents replay attacks if a refresh token is stolen.
    """
    try:
        # Decode and verify the refresh token
        payload = decode_refresh_token(request.refresh_token)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid refresh token: {str(e)}",
        )

    jti = payload.get("jti", "")
    user_id = payload.get("sub", "")

    # Check if refresh token is blacklisted (rotation already used)
    from .blacklist import is_refresh_token_blacklisted
    if jti and is_refresh_token_blacklisted(jti):
        # Token reuse detected! This could be a replay attack.
        # As a security measure, revoke ALL tokens for this user.
        if user_id:
            blacklist_user_all_tokens(user_id)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has already been used. All sessions revoked for security.",
        )

    # Blacklist the old refresh token (rotation)
    exp = payload.get("exp", 0)
    remaining_ttl = get_token_remaining_ttl(exp)
    if jti:
        blacklist_refresh_token(jti, remaining_ttl)

    # Fetch user info from DB to include in new tokens
    session = get_session()
    try:
        from sqlalchemy import text

        result = session.execute(
            text("SELECT id, username, display_name, role FROM users WHERE id = :user_id AND status = 'ACTIVE'"),
            {"user_id": user_id},
        ).fetchone()

        if not result:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive",
            )

        _, username, display_name, role = result

        # Build permissions
        from src.auth.permissions import ROLE_PERMISSIONS
        permissions = ROLE_PERMISSIONS.get(role, [])

        # Issue new tokens
        access_token = create_access_token(
            subject=user_id,
            role=role,
            extra_claims={
                "username": username,
                "display_name": display_name,
                "permissions": permissions,
            },
        )
        new_refresh_token = create_refresh_token(subject=user_id)

        from .jwt_utils import ACCESS_TOKEN_TTL_MINUTES
        expires_in = ACCESS_TOKEN_TTL_MINUTES * 60

        return TokenResponse(
            access_token=access_token,
            refresh_token=new_refresh_token,
            expires_in=expires_in,
        )
    finally:
        session.close()


# ---------------------------------------------------------------------------
# POST /api/auth/logout
# ---------------------------------------------------------------------------
@router.post("/logout", response_model=LogoutResponse)
async def logout(current_user: AuthUser = Depends(get_current_user)):
    """Revoke the current access token.

    The token's JTI is added to the Redis blacklist with a TTL
    matching the token's remaining lifetime.
    """
    exp = current_user.token_payload.get("exp", 0)
    remaining_ttl = get_token_remaining_ttl(exp)

    if current_user.jti:
        blacklist_access_token(current_user.jti, remaining_ttl)

    return LogoutResponse(message="Logged out successfully")


# ---------------------------------------------------------------------------
# POST /api/auth/logout/all
# ---------------------------------------------------------------------------
@router.post("/logout/all", response_model=LogoutResponse)
async def logout_all(current_user: AuthUser = Depends(get_current_user)):
    """Revoke ALL tokens for the current user (force logout all sessions)."""
    blacklist_user_all_tokens(current_user.id)
    return LogoutResponse(message="All sessions revoked successfully")


# ---------------------------------------------------------------------------
# GET /api/auth/me
# ---------------------------------------------------------------------------
@router.get("/me", response_model=UserProfile)
async def get_me(current_user: AuthUser = Depends(get_current_user)):
    """Get the current user's profile from the access token claims."""
    payload = current_user.token_payload
    return UserProfile(
        id=current_user.id,
        username=payload.get("username", ""),
        display_name=payload.get("display_name", ""),
        role=current_user.role,
        permissions=payload.get("permissions", []),
    )


# ---------------------------------------------------------------------------
# GET /api/auth/.well-known/jwks.json
# ---------------------------------------------------------------------------
@router.get("/.well-known/jwks.json")
async def jwks_endpoint():
    """JWKS (JSON Web Key Set) endpoint.

    Other services (API Gateway, microservices) fetch this to get
    the public keys for verifying JWT signatures locally.
    """
    return get_jwks()

"""
Redis-based Token Blacklist Manager.

Architecture:
  - Uses Redis to store revoked token IDs (jti) with TTL equal to the token's remaining lifetime.
  - O(1) lookup for every request to check if a token has been revoked.
  - Supports both access token and refresh token blacklisting.
"""

import os
import json
import time
from typing import Optional

import redis as redis_lib

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
REDIS_URL = os.getenv(
    "REDIS_URL",
    "redis://localhost:6379/0",
)

# Prefixes for Redis keys
_ACCESS_BLACKLIST_PREFIX = "jwt:blacklist:access:"
_REFRESH_BLACKLIST_PREFIX = "jwt:blacklist:refresh:"

# Singleton Redis client
_redis_client: Optional[redis_lib.Redis] = None


def _get_redis() -> redis_lib.Redis:
    """Get or create the Redis connection (lazy singleton)."""
    global _redis_client
    if _redis_client is None:
        _redis_client = redis_lib.from_url(
            REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=3,
            socket_timeout=3,
        )
    return _redis_client


# ---------------------------------------------------------------------------
# Blacklist Operations
# ---------------------------------------------------------------------------
def blacklist_access_token(jti: str, ttl_seconds: int) -> None:
    """Add an access token's JTI to the Redis blacklist.

    Args:
        jti: The JWT ID (unique token identifier).
        ttl_seconds: Time-to-live in seconds (should match remaining token lifetime).
    """
    if ttl_seconds <= 0:
        return
    r = _get_redis()
    key = f"{_ACCESS_BLACKLIST_PREFIX}{jti}"
    r.setex(key, ttl_seconds, "1")


def blacklist_refresh_token(jti: str, ttl_seconds: int) -> None:
    """Add a refresh token's JTI to the Redis blacklist.

    Args:
        jti: The JWT ID (unique token identifier).
        ttl_seconds: Time-to-live in seconds (should match remaining token lifetime).
    """
    if ttl_seconds <= 0:
        return
    r = _get_redis()
    key = f"{_REFRESH_BLACKLIST_PREFIX}{jti}"
    r.setex(key, ttl_seconds, "1")


def is_access_token_blacklisted(jti: str) -> bool:
    """Check if an access token JTI is in the blacklist.

    Args:
        jti: The JWT ID to check.

    Returns:
        True if the token has been revoked.
    """
    r = _get_redis()
    key = f"{_ACCESS_BLACKLIST_PREFIX}{jti}"
    return r.exists(key) > 0


def is_refresh_token_blacklisted(jti: str) -> bool:
    """Check if a refresh token JTI is in the blacklist.

    Args:
        jti: The JWT ID to check.

    Returns:
        True if the token has been revoked.
    """
    r = _get_redis()
    key = f"{_REFRESH_BLACKLIST_PREFIX}{jti}"
    return r.exists(key) > 0


def blacklist_user_all_tokens(user_id: str) -> None:
    """Blacklist all tokens for a given user by adding a user-level block.

    This is a simpler approach than tracking every JTI per user.
    We store a user-level blacklist entry that gets checked during verification.

    Args:
        user_id: The user ID to block all tokens for.
    """
    r = _get_redis()
    # Store a user-level block with a 24-hour TTL (max token lifetime)
    key = f"jwt:blacklist:user:{user_id}"
    r.setex(key, 86400, str(int(time.time())))


def is_user_blacklisted(user_id: str) -> bool:
    """Check if a user has been globally blacklisted (force logout all sessions).

    Args:
        user_id: The user ID to check.

    Returns:
        True if the user has been force-logged-out.
    """
    r = _get_redis()
    key = f"jwt:blacklist:user:{user_id}"
    return r.exists(key) > 0


def get_token_remaining_ttl(exp_timestamp: int) -> int:
    """Calculate remaining TTL in seconds from an expiration timestamp.

    Args:
        exp_timestamp: Unix timestamp (seconds) when the token expires.

    Returns:
        Remaining seconds, or 0 if already expired.
    """
    remaining = exp_timestamp - int(time.time())
    return max(remaining, 0)


# ---------------------------------------------------------------------------
# Health Check
# ---------------------------------------------------------------------------
def ping() -> bool:
    """Check if Redis is reachable."""
    try:
        r = _get_redis()
        return r.ping()
    except Exception:
        return False

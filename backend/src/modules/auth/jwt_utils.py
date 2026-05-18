"""
JWT Utility Module — RS256 asymmetric signing with JWKS support.

Architecture:
  - Auth Service holds the PRIVATE KEY to sign tokens.
  - Other services fetch PUBLIC KEYS via the JWKS endpoint and cache them in memory.
  - Access Token: short-lived (15-30 min), contains minimal claims (sub, role, jti).
  - Refresh Token: long-lived (7-30 days), opaque or JWT, with rotation support.
"""

import os
import json
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from jose import jwt, jwk, JWTError
from jose.constants import Algorithms
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.backends import default_backend

# ---------------------------------------------------------------------------
# Configuration (can be overridden via env vars)
# ---------------------------------------------------------------------------
ACCESS_TOKEN_TTL_MINUTES = int(os.getenv("JWT_ACCESS_TTL_MINUTES", "15"))
REFRESH_TOKEN_TTL_DAYS = int(os.getenv("JWT_REFRESH_TTL_DAYS", "30"))
ALGORITHM = Algorithms.RS256  # RS256 — asymmetric

# Paths for RSA key pair (auto-generated if missing)
PRIVATE_KEY_PATH = os.getenv("JWT_PRIVATE_KEY_PATH", "/app/secrets/jwt_private.pem")
PUBLIC_KEY_PATH = os.getenv("JWT_PUBLIC_KEY_PATH", "/app/secrets/jwt_public.pem")

# In-memory cache for JWKS
_jwks_cache: Optional[dict] = None
_kid: Optional[str] = None


# ---------------------------------------------------------------------------
# RSA Key Pair Generation & Loading
# ---------------------------------------------------------------------------
def _ensure_keys_exist() -> None:
    """Auto-generate RSA-2048 key pair if private key file doesn't exist."""
    if os.path.exists(PRIVATE_KEY_PATH):
        return

    os.makedirs(os.path.dirname(PRIVATE_KEY_PATH), exist_ok=True)

    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend(),
    )

    # Write private key
    with open(PRIVATE_KEY_PATH, "wb") as f:
        f.write(
            private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption(),
            )
        )

    # Write public key
    public_key = private_key.public_key()
    with open(PUBLIC_KEY_PATH, "wb") as f:
        f.write(
            public_key.public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo,
            )
        )

    print(f"🔑 RSA key pair generated: {PRIVATE_KEY_PATH}")


def _load_private_key() -> rsa.RSAPrivateKey:
    """Load the RSA private key from PEM file."""
    _ensure_keys_exist()
    with open(PRIVATE_KEY_PATH, "rb") as f:
        return serialization.load_pem_private_key(
            f.read(), password=None, backend=default_backend()
        )


def _load_public_key() -> rsa.RSAPublicKey:
    """Load the RSA public key from PEM file."""
    _ensure_keys_exist()
    with open(PUBLIC_KEY_PATH, "rb") as f:
        return serialization.load_pem_public_key(f.read(), backend=default_backend())


def _get_kid() -> str:
    """Return a stable Key ID (kid) based on public key fingerprint."""
    global _kid
    if _kid is None:
        public_key = _load_public_key()
        # Use SHA-256 thumbprint of the public key in SPKI format
        from cryptography.hazmat.primitives import hashes

        digest = hashes.Hash(hashes.SHA256(), backend=default_backend())
        digest.update(
            public_key.public_bytes(
                encoding=serialization.Encoding.DER,
                format=serialization.PublicFormat.SubjectPublicKeyInfo,
            )
        )
        _kid = digest.finalize().hex()[:16]
    return _kid


# ---------------------------------------------------------------------------
# Token Creation
# ---------------------------------------------------------------------------
def create_access_token(
    subject: str,
    role: str,
    extra_claims: Optional[dict] = None,
    ttl_minutes: Optional[int] = None,
) -> str:
    """Create a signed JWT Access Token (RS256).

    Args:
        subject: User ID (sub claim).
        role: User role for authorization.
        extra_claims: Optional additional claims to embed.
        ttl_minutes: Token lifetime in minutes (default: ACCESS_TOKEN_TTL_MINUTES).

    Returns:
        Encoded JWT string.
    """
    now = datetime.now(timezone.utc)
    ttl = ttl_minutes or ACCESS_TOKEN_TTL_MINUTES
    jti = str(uuid.uuid4())

    payload = {
        "sub": subject,
        "role": role,
        "jti": jti,
        "iat": now,
        "exp": now + timedelta(minutes=ttl),
        "iss": "truckflow-auth",
        "type": "access",
    }

    if extra_claims:
        # Only add safe, non-standard claims
        for k, v in extra_claims.items():
            if k not in payload:
                payload[k] = v

    private_key = _load_private_key()
    return jwt.encode(
        payload,
        private_key,
        algorithm=ALGORITHM,
        headers={"kid": _get_kid()},
    )


def create_refresh_token(subject: str) -> str:
    """Create a signed JWT Refresh Token (RS256).

    The refresh token has a longer TTL and is used exclusively
    to obtain new access tokens.

    Args:
        subject: User ID (sub claim).

    Returns:
        Encoded JWT string.
    """
    now = datetime.now(timezone.utc)
    jti = str(uuid.uuid4())

    payload = {
        "sub": subject,
        "jti": jti,
        "iat": now,
        "exp": now + timedelta(days=REFRESH_TOKEN_TTL_DAYS),
        "iss": "truckflow-auth",
        "type": "refresh",
    }

    private_key = _load_private_key()
    return jwt.encode(
        payload,
        private_key,
        algorithm=ALGORITHM,
        headers={"kid": _get_kid()},
    )


# ---------------------------------------------------------------------------
# Token Verification
# ---------------------------------------------------------------------------
def decode_token(token: str) -> dict:
    """Decode and verify a JWT token using the public key.

    Args:
        token: The JWT string to verify.

    Returns:
        Decoded payload dict.

    Raises:
        JWTError: If token is invalid, expired, or signature mismatch.
    """
    public_key = _load_public_key()
    payload = jwt.decode(
        token,
        public_key,
        algorithms=[ALGORITHM],
        issuer="truckflow-auth",
        options={"verify_exp": True},
    )
    return payload


def decode_access_token(token: str) -> dict:
    """Decode and verify an Access Token, ensuring it's of type 'access'."""
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise JWTError("Token is not an access token")
    return payload


def decode_refresh_token(token: str) -> dict:
    """Decode and verify a Refresh Token, ensuring it's of type 'refresh'."""
    payload = decode_token(token)
    if payload.get("type") != "refresh":
        raise JWTError("Token is not a refresh token")
    return payload


# ---------------------------------------------------------------------------
# JWKS Endpoint Helper
# ---------------------------------------------------------------------------
def get_jwks() -> dict:
    """Return the JWKS (JSON Web Key Set) for this auth service.

    Other services fetch this endpoint and cache the public keys
    to verify tokens locally without calling the auth service.
    """
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache

    public_key = _load_public_key()
    kid = _get_kid()

    # Manually construct JWK from RSA public key components
    public_numbers = public_key.public_numbers()

    # Base64url encode the modulus (n) and exponent (e)
    import base64

    def _b64url_encode(data: bytes) -> str:
        return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")

    n_bytes = public_numbers.n.to_bytes(
        (public_numbers.n.bit_length() + 7) // 8, byteorder="big"
    )
    e_bytes = public_numbers.e.to_bytes(
        (public_numbers.e.bit_length() + 7) // 8, byteorder="big"
    )

    jwk_dict = {
        "kty": "RSA",
        "n": _b64url_encode(n_bytes),
        "e": _b64url_encode(e_bytes),
        "kid": kid,
        "use": "sig",
        "alg": ALGORITHM,
    }

    _jwks_cache = {"keys": [jwk_dict]}
    return _jwks_cache


def invalidate_jwks_cache() -> None:
    """Force JWKS cache refresh (call after key rotation)."""
    global _jwks_cache
    _jwks_cache = None

"""Security & Authentication Services.

Implements strict JWT signature verification, audience/issuer validation,
Supabase Auth integration, and safe local development authentication.
"""

from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import secrets
from typing import Any, Dict, List, Optional
import jwt
from pydantic import BaseModel, Field

from app.core.config import Settings, get_settings
from app.core.exceptions import AuthenticationFailedError
from app.core.logging import get_logger

logger = get_logger("security")

# Permitted cryptographic signing algorithms
ALLOWED_SYMMETRIC_ALGORITHMS = {"HS256"}
ALLOWED_ASYMMETRIC_ALGORITHMS = {"ES256", "RS256"}
ALL_ALLOWED_ALGORITHMS = ALLOWED_SYMMETRIC_ALGORITHMS | ALLOWED_ASYMMETRIC_ALGORITHMS

# Global thread-safe JWKS client cache with bounded retention
_jwks_clients: Dict[str, jwt.PyJWKClient] = {}


def get_jwks_client(supabase_url: str) -> jwt.PyJWKClient:
    """Retrieve or initialize a cached, bounded PyJWKClient for a Supabase URL."""
    base_url = supabase_url.rstrip("/")
    jwks_url = f"{base_url}/auth/v1/.well-known/jwks.json"
    if jwks_url not in _jwks_clients:
        _jwks_clients[jwks_url] = jwt.PyJWKClient(
            jwks_url,
            cache_keys=True,
            max_cached_keys=16,
            cache_jwk_set=True,
            lifespan=300,  # 5 minutes bounded caching
            cooldown_duration=30,  # 30-second cooldown between refresh attempts for unknown kid
            timeout=10.0,  # 10 second network timeout
        )
    return _jwks_clients[jwks_url]


def reset_jwks_clients_for_tests() -> None:
    """Reset cached JWKS clients for isolated unit testing."""
    global _jwks_clients
    _jwks_clients.clear()


def hash_password(password: str) -> str:
    """Hash password using scrypt with random 16-byte salt (OWASP recommended)."""
    if not password:
        raise ValueError("Password cannot be empty.")
    salt = secrets.token_hex(16)
    derived = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt.encode("utf-8"),
        n=16384,
        r=8,
        p=1,
    ).hex()
    return f"scrypt$16384$8$1${salt}${derived}"


def verify_password(password: str, hashed_password: str) -> bool:
    """Verify password against scrypt hash in constant time."""
    if not password or not hashed_password:
        return False
    try:
        parts = hashed_password.split("$")
        if len(parts) == 6 and parts[0] == "scrypt":
            n = int(parts[1])
            r = int(parts[2])
            p = int(parts[3])
            salt = parts[4].encode("utf-8")
            expected_hash = parts[5]
            derived = hashlib.scrypt(
                password.encode("utf-8"),
                salt=salt,
                n=n,
                r=r,
                p=p,
            ).hex()
            return hmac.compare_digest(derived, expected_hash)
        return False
    except Exception as e:
        logger.warning("Password verification failed with exception: %s", str(e))
        return False


class TokenPayload(BaseModel):
    """Structured and validated claims from a verified JWT token."""

    sub: str = Field(description="Subject identifier (Supabase UID or local user ID)")
    email: Optional[str] = Field(default=None, description="User email address")
    role: Optional[str] = Field(default="authenticated", description="User role")
    exp: Optional[int] = Field(default=None, description="Expiration UNIX timestamp")
    iat: Optional[int] = Field(default=None, description="Issued-at UNIX timestamp")
    aud: Optional[str] = Field(default=None, description="Audience claim")
    iss: Optional[str] = Field(default=None, description="Issuer claim")
    app_metadata: Dict[str, Any] = Field(default_factory=dict)
    user_metadata: Dict[str, Any] = Field(default_factory=dict)
    is_dev: bool = Field(default=False, description="Whether token was issued in local dev mode")


def create_access_token(
    data: Dict[str, Any],
    secret: str,
    algorithm: str = "HS256",
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create a signed JWT token. Used for tests and controlled dev auth."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(hours=1)

    to_encode.update({
        "exp": int(expire.timestamp()),
        "iat": int(now.timestamp()),
    })
    return jwt.encode(to_encode, secret, algorithm=algorithm)


def verify_jwt_token(token: str, settings: Optional[Settings] = None) -> TokenPayload:
    """Verify cryptographic signature and claims of an incoming JWT token.

    Never trusts unverified claims. Enforces strict algorithm, expiration,
    and optional audience/issuer checks.
    """
    if not token or not isinstance(token, str):
        raise AuthenticationFailedError("Authorization token must be a non-empty string.")

    token = token.strip()
    if token.lower().startswith("bearer "):
        token = token[7:].strip()

    if settings is None:
        settings = get_settings()

    # 1. Inspect unverified header to reject insecure or disallowed algorithms
    try:
        unverified_header = jwt.get_unverified_header(token)
    except jwt.PyJWTError as e:
        logger.warning("Rejected token with malformed header: %s", str(e))
        raise AuthenticationFailedError("Malformed token header.")

    alg = unverified_header.get("alg")
    if not alg or not isinstance(alg, str) or alg.lower() == "none":
        logger.warning("Rejected token with 'none' or missing algorithm")
        raise AuthenticationFailedError("Insecure token algorithm is forbidden.")

    alg_upper = alg.upper().strip()
    if alg_upper not in ALL_ALLOWED_ALGORITHMS:
        logger.warning("Rejected token with unauthorized algorithm: %s", alg)
        raise AuthenticationFailedError("Insecure or unsupported token algorithm is forbidden.")

    # 2. Strict verification options
    verify_options = {
        "verify_signature": True,
        "verify_exp": True,
        "verify_iat": True,
    }

    # Audience and issuer checks if configured
    expected_aud = settings.SUPABASE_JWT_AUDIENCE if settings.SUPABASE_JWT_AUDIENCE else None
    expected_iss = settings.SUPABASE_JWT_ISSUER if settings.SUPABASE_JWT_ISSUER else None

    # 3. Asymmetric verification (ES256, RS256 via Supabase JWKS)
    if alg_upper in ALLOWED_ASYMMETRIC_ALGORITHMS:
        kid = unverified_header.get("kid")
        if not kid or not isinstance(kid, str) or not kid.strip():
            logger.warning("Rejected asymmetric token missing required 'kid' header claim")
            raise AuthenticationFailedError("Asymmetric token header missing 'kid'.")

        if not settings.SUPABASE_URL or "placeholder" in settings.SUPABASE_URL:
            logger.warning("Cannot verify asymmetric token: SUPABASE_URL is not configured")
            raise AuthenticationFailedError("Asymmetric key verification unavailable: invalid JWKS configuration.")

        jwks_client = get_jwks_client(settings.SUPABASE_URL)
        try:
            signing_key = jwks_client.get_signing_key_from_jwt(token)
        except jwt.PyJWKClientConnectionError as conn_err:
            logger.warning("JWKS service unavailable: %s", str(conn_err))
            raise AuthenticationFailedError("Unable to verify token signature: key service unavailable.")
        except jwt.PyJWKError as jwk_err:
            logger.warning("JWKS key error for kid: %s", str(jwk_err))
            raise AuthenticationFailedError("Invalid or unknown signing key identifier.")

        try:
            decode_kwargs = {
                "jwt": token,
                "key": signing_key.key,
                "algorithms": [alg_upper],
                "options": verify_options,
            }
            if expected_aud:
                decode_kwargs["audience"] = expected_aud
            if expected_iss:
                decode_kwargs["issuer"] = expected_iss

            payload = jwt.decode(**decode_kwargs)
            return _extract_token_payload(payload, is_dev=False)
        except jwt.ExpiredSignatureError:
            raise AuthenticationFailedError("Token has expired.")
        except jwt.InvalidAudienceError:
            raise AuthenticationFailedError("Token audience is invalid.")
        except jwt.InvalidIssuerError:
            raise AuthenticationFailedError("Token issuer is invalid.")
        except jwt.PyJWTError as e:
            logger.warning("Asymmetric token signature verification failed: %s", str(e))
            raise AuthenticationFailedError("Invalid token signature.")

    # 4. Symmetric verification (HS256 via SUPABASE_JWT_SECRET or local SECRET_KEY)
    elif alg_upper in ALLOWED_SYMMETRIC_ALGORITHMS:
        supabase_secret = settings.SUPABASE_JWT_SECRET.get_secret_value()
        try:
            decode_kwargs = {
                "jwt": token,
                "key": supabase_secret,
                "algorithms": ["HS256"],
                "options": verify_options,
            }
            if expected_aud:
                decode_kwargs["audience"] = expected_aud
            if expected_iss:
                decode_kwargs["issuer"] = expected_iss

            payload = jwt.decode(**decode_kwargs)
            return _extract_token_payload(payload, is_dev=False)
        except jwt.ExpiredSignatureError:
            logger.info("Authentication failed: token signature expired")
            raise AuthenticationFailedError("Token has expired.")
        except jwt.InvalidAudienceError:
            logger.warning("Authentication failed: invalid token audience")
            raise AuthenticationFailedError("Token audience is invalid.")
        except jwt.InvalidIssuerError:
            logger.warning("Authentication failed: invalid token issuer")
            raise AuthenticationFailedError("Token issuer is invalid.")
        except jwt.InvalidSignatureError:
            # Signature did not match Supabase secret.
            # Verify against application SECRET_KEY (native user authentication or controlled dev auth)
            local_secret = settings.SECRET_KEY.get_secret_value()
            try:
                local_decode_kwargs = {
                    "jwt": token,
                    "key": local_secret,
                    "algorithms": ["HS256"],
                    "options": verify_options,
                }
                if expected_aud:
                    local_decode_kwargs["audience"] = expected_aud
                if expected_iss:
                    local_decode_kwargs["issuer"] = expected_iss

                local_payload = jwt.decode(**local_decode_kwargs)
                logger.debug("Successfully validated application token")
                return _extract_token_payload(local_payload, is_dev=bool(local_payload.get("is_dev", False)))
            except jwt.ExpiredSignatureError:
                raise AuthenticationFailedError("Token has expired.")
            except jwt.InvalidAudienceError:
                raise AuthenticationFailedError("Token audience is invalid.")
            except jwt.InvalidIssuerError:
                raise AuthenticationFailedError("Token issuer is invalid.")
            except jwt.PyJWTError as sig_err:
                logger.warning("Token signature verification failed: %s", str(sig_err))
                raise AuthenticationFailedError("Invalid token signature.")
        except jwt.PyJWTError as e:
            logger.warning("Token verification failed: %s", str(e))
            raise AuthenticationFailedError("Invalid authentication token.")

    else:
        logger.warning("Rejected token with unauthorized algorithm: %s", alg)
        raise AuthenticationFailedError("Insecure or unsupported token algorithm is forbidden.")


def _extract_token_payload(payload: Dict[str, Any], is_dev: bool = False) -> TokenPayload:
    """Safely map raw token claims to TokenPayload schema."""
    sub = payload.get("sub")
    if not sub:
        raise AuthenticationFailedError("Token is missing required 'sub' claim.")

    email = payload.get("email")
    role = payload.get("role") or payload.get("aud", "authenticated")
    user_metadata = payload.get("user_metadata", {})
    app_metadata = payload.get("app_metadata", {})

    # In Supabase, email is often in payload or in user_metadata
    if not email and isinstance(user_metadata, dict):
        email = user_metadata.get("email")

    return TokenPayload(
        sub=str(sub),
        email=str(email) if email else None,
        role=str(role) if role else "authenticated",
        exp=payload.get("exp"),
        iat=payload.get("iat"),
        aud=payload.get("aud"),
        iss=payload.get("iss"),
        app_metadata=app_metadata if isinstance(app_metadata, dict) else {},
        user_metadata=user_metadata if isinstance(user_metadata, dict) else {},
        is_dev=is_dev,
    )

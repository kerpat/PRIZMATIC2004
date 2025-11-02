"""Centralized Supabase client helpers for Python runtimes."""
from __future__ import annotations

import os
from typing import Optional

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    # dotenv is optional; ignore if not installed
    pass

from supabase import Client, create_client

# === Supabase environment keys ===
SUPABASE_URL: Optional[str] = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY: Optional[str] = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY: Optional[str] = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

_service_role_client: Optional[Client] = None
_anon_client: Optional[Client] = None


def _ensure(variable: Optional[str], name: str) -> str:
    if not variable:
        raise RuntimeError(f"{name} must be provided via environment variables or .env file")
    return variable


def get_supabase_service_role_client() -> Client:
    """Returns a cached Supabase client authorized with the service role key."""
    global _service_role_client
    if _service_role_client is None:
        url = _ensure(SUPABASE_URL, "SUPABASE_URL")
        key = _ensure(SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY")
        _service_role_client = create_client(url, key)
    return _service_role_client


def get_supabase_anon_client() -> Client:
    """Returns a cached Supabase client authorized with the anon key."""
    global _anon_client
    if _anon_client is None:
        url = _ensure(SUPABASE_URL, "SUPABASE_URL")
        key = _ensure(SUPABASE_ANON_KEY, "SUPABASE_ANON_KEY")
        _anon_client = create_client(url, key)
    return _anon_client


def reset_supabase_clients() -> None:
    """Clears cached Supabase clients (useful for tests)."""
    global _service_role_client, _anon_client
    _service_role_client = None
    _anon_client = None


__all__ = [
    "get_supabase_service_role_client",
    "get_supabase_anon_client",
    "reset_supabase_clients",
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
]

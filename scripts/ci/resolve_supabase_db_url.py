#!/usr/bin/env python3
"""Compute an IPv4-friendly connection string for Supabase migrations."""

from __future__ import annotations

import json
import os
import socket
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Iterable, Optional

PROJECT_ENV = "SUPABASE_PROJECT_REF"
URL_ENV = "SUPABASE_DB_URL"
PASSWORD_ENV = "SUPABASE_DB_PASSWORD"

DEFAULT_SCHEME = "postgresql"
DEFAULT_DATABASE = "postgres"
SSL_PARAM = ("sslmode", "require")
POOLER_TEMPLATE_PATH = (
    Path(__file__).resolve().parents[2] / "supabase" / ".temp" / "pooler-url"
)


def build_url() -> str:
    env_url = os.environ.get(URL_ENV)
    password_env = os.environ.get(PASSWORD_ENV)
    project_env = os.environ.get(PROJECT_ENV)

    params = _parse_url(env_url)

    if params is None:
        if not password_env or not project_env:
            raise RuntimeError(
                "Supabase connection string missing. Provide SUPABASE_DB_URL or SUPABASE_DB_PASSWORD."
            )
        params = _direct_params(project_env, password_env)

    template = _read_pooler_template()
    if not template:
        template = _fetch_pooler_connection(project_env or _project_from_params(params))
    params = _maybe_switch_to_pooler(params, template, password_env, project_env)

    params = _ensure_username(params, project_env)
    params = _ensure_password(params, password_env)
    params = _normalize_host(params)
    params = _ensure_database(params)
    params = _ensure_sslmode(params)
    params = _maybe_add_hostaddr(params)

    return _compose_url(params)


def _resolve_ipv4(host: str, port: int) -> Optional[str]:
    try:
        infos = socket.getaddrinfo(host, port, family=socket.AF_INET, type=socket.SOCK_STREAM)
    except socket.gaierror:
        return None
    if not infos:
        return None
    return infos[0][4][0]


def _parse_url(url: Optional[str]) -> Optional[dict[str, object]]:
    if not url:
        return None
    if "[YOUR-PASSWORD]" in url:
        url = url.replace("[YOUR-PASSWORD]", "")
    parts = urllib.parse.urlsplit(url)
    return {
        "scheme": parts.scheme or DEFAULT_SCHEME,
        "username": parts.username or "",
        "password": parts.password or "",
        "host": (parts.hostname or "").lower(),
        "port": parts.port,
        "database": parts.path.lstrip("/") or "",
        "query": urllib.parse.parse_qsl(parts.query, keep_blank_values=True),
        "fragment": parts.fragment or "",
    }


def _direct_params(project: str, password: str) -> dict[str, object]:
    return {
        "scheme": DEFAULT_SCHEME,
        "username": "postgres",
        "password": password,
        "host": f"db.{project}.supabase.co",
        "port": 5432,
        "database": DEFAULT_DATABASE,
        "query": [SSL_PARAM],
        "fragment": "",
    }


def _read_pooler_template() -> Optional[str]:
    try:
        return POOLER_TEMPLATE_PATH.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        return None


def _fetch_pooler_connection(project: Optional[str]) -> Optional[str]:
    token = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if not token or not project:
        return None

    api_url = os.environ.get("SUPABASE_API_URL", "https://api.supabase.com")
    api_url = api_url.rstrip("/")
    request_url = f"{api_url}/v1/projects/{project}/config/database/pooler"

    req = urllib.request.Request(
        request_url,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "User-Agent": "Applications-Tracker-CI/1.0",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status != 200:
                return None
            try:
                payload = json.loads(resp.read().decode("utf-8"))
            except json.JSONDecodeError:
                return None
    except (urllib.error.URLError, TimeoutError):
        return None

    if not isinstance(payload, list):
        return None

    for entry in payload:
        if not isinstance(entry, dict):
            continue
        if entry.get("database_type") == "PRIMARY" and entry.get("connection_string"):
            return str(entry["connection_string"])
    return None


def _maybe_switch_to_pooler(
    params: dict[str, object],
    template: Optional[str],
    password_env: Optional[str],
    project_env: Optional[str],
) -> dict[str, object]:
    host = str(params.get("host", "")).lower()
    if not template or (host and not _is_supabase_host(host)):
        return params

    password = str(params.get("password") or password_env or "")
    if not password:
        return params

    project = project_env or _project_from_params(params)
    if not project:
        project = _project_from_template(template)
    if not project:
        return params

    pooler_params = _parse_url(template)
    if pooler_params is None:
        return params

    pooler_params["scheme"] = pooler_params.get("scheme") or params.get("scheme", DEFAULT_SCHEME)
    pooler_params["password"] = password
    pooler_params["database"] = pooler_params.get("database") or params.get("database") or DEFAULT_DATABASE
    pooler_params["fragment"] = ""
    pooler_params["query"] = list(pooler_params.get("query", []))
    pooler_params["username"] = _username_with_project(
        str(pooler_params.get("username") or "postgres"), project
    )
    pooler_params["host"] = str(pooler_params.get("host", "")).lower()
    pooler_params["port"] = _pooler_port(pooler_params.get("port"))
    pooler_params = _ensure_sslmode(pooler_params)
    return pooler_params


def _ensure_username(params: dict[str, object], project_env: Optional[str]) -> dict[str, object]:
    username = str(params.get("username") or "")
    host = str(params.get("host") or "").lower()
    if username:
        return params
    if _is_pooler_host(host) and project_env:
        params["username"] = _username_with_project("postgres", project_env)
    else:
        params["username"] = "postgres"
    return params


def _ensure_password(params: dict[str, object], password_env: Optional[str]) -> dict[str, object]:
    password = str(params.get("password") or password_env or "")
    if not password:
        raise RuntimeError(
            "Supabase connection password missing. Set SUPABASE_DB_PASSWORD or include it in SUPABASE_DB_URL."
        )
    params["password"] = password
    return params


def _normalize_host(params: dict[str, object]) -> dict[str, object]:
    host = str(params.get("host") or "").lower()
    if host.startswith("db.") and host.endswith(".supabase.net"):
        host = host[: -len(".supabase.net")] + ".supabase.co"
    params["host"] = host
    return params


def _ensure_database(params: dict[str, object]) -> dict[str, object]:
    database = str(params.get("database") or "") or DEFAULT_DATABASE
    params["database"] = database
    return params


def _ensure_sslmode(params: dict[str, object]) -> dict[str, object]:
    query = list(params.get("query", []))
    if not _has_param(query, SSL_PARAM[0]):
        query.append(SSL_PARAM)
    params["query"] = query
    return params


def _maybe_add_hostaddr(params: dict[str, object]) -> dict[str, object]:
    host = str(params.get("host") or "")
    port = int(params.get("port") or 5432)
    query = list(params.get("query", []))

    if _is_pooler_host(host):
        params["query"] = [(k, v) for k, v in query if k != "hostaddr"]
        return params

    if not _has_param(query, "hostaddr") and host:
        ipv4 = _resolve_ipv4(host, port)
        if ipv4:
            query.append(("hostaddr", ipv4))
    params["query"] = query
    return params


def _compose_url(params: dict[str, object]) -> str:
    scheme = str(params.get("scheme") or DEFAULT_SCHEME)
    username = urllib.parse.quote(str(params.get("username") or ""))
    password = str(params.get("password") or "")
    if password:
        password = ":" + urllib.parse.quote(password)
    host = str(params.get("host") or "")
    port = params.get("port")
    port_str = f":{int(port)}" if port else ""
    database = str(params.get("database") or DEFAULT_DATABASE)
    path = f"/{urllib.parse.quote(database)}"
    query = urllib.parse.urlencode(params.get("query", []), doseq=True)
    fragment = str(params.get("fragment") or "")

    netloc = host
    if username or password:
        netloc = f"{username}{password}@{netloc}"
    netloc += port_str

    return urllib.parse.urlunsplit((scheme, netloc, path, query, fragment))


def _has_param(query: Iterable[tuple[str, str]], key: str) -> bool:
    return any(name == key for name, _ in query)


def _is_supabase_host(host: str) -> bool:
    return host.endswith(".supabase.co") or host.endswith(".supabase.net") or host.endswith(".supabase.com")


def _is_pooler_host(host: str) -> bool:
    return host.endswith(".pooler.supabase.com") or host.endswith(".pooler.supabase.net")


def _username_with_project(username: str, project: str) -> str:
    base = username.split(".", 1)[0] if username else "postgres"
    return f"{base}.{project}"


def _pooler_port(default: Optional[object]) -> int:
    override = os.environ.get("SUPABASE_POOLER_PORT")
    if override:
        try:
            return int(override)
        except ValueError:
            pass
    mode = os.environ.get("SUPABASE_POOLER_MODE", "session").lower()
    if mode == "transaction":
        return 6543
    if mode == "session":
        return 5432
    if isinstance(default, int):
        return default
    return 5432


def _project_from_params(params: dict[str, object]) -> str:
    host = str(params.get("host") or "").lower()
    if host.startswith("db.") and ".supabase" in host:
        return host.split(".", 1)[1].split(".", 1)[0]
    username = str(params.get("username") or "")
    if "." in username:
        return username.split(".", 1)[1]
    for key, value in params.get("query", []):
        if key == "options":
            for option in value.split(","):
                if option.startswith("reference="):
                    return option.split("=", 1)[1]
    return ""


def _project_from_template(template: str) -> str:
    parsed = _parse_url(template)
    if not parsed:
        return ""
    return _project_from_params(parsed)


def main() -> int:
    try:
        print(build_url())
    except RuntimeError as exc:
        print(f"::error::{exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Compute an IPv4-friendly connection string for Supabase migrations."""

from __future__ import annotations

import os
import socket
import sys
import urllib.parse
from typing import Optional

PROJECT_ENV = "SUPABASE_PROJECT_REF"
URL_ENV = "SUPABASE_DB_URL"
PASSWORD_ENV = "SUPABASE_DB_PASSWORD"


def build_url() -> str:
    url = os.environ.get(URL_ENV)
    if not url:
        password = os.environ.get(PASSWORD_ENV)
        project = os.environ.get(PROJECT_ENV)
        if not password or not project:
            raise RuntimeError(
                "Supabase connection string missing. Provide SUPABASE_DB_URL or SUPABASE_DB_PASSWORD."
            )
        url = "postgresql://postgres:{password}@db.{project}.supabase.co:5432/postgres?sslmode=require".format(
            password=urllib.parse.quote(password),
            project=project,
        )

    parts = urllib.parse.urlparse(url)
    host = parts.hostname or ""
    port = parts.port or 5432

    query_items = urllib.parse.parse_qsl(parts.query, keep_blank_values=True)
    has_hostaddr = any(key == "hostaddr" for key, _ in query_items)

    if host and not has_hostaddr:
        ipv4 = _resolve_ipv4(host, port)
        if ipv4:
            query_items.append(("hostaddr", ipv4))

    new_query = urllib.parse.urlencode(query_items, doseq=True)
    return urllib.parse.urlunparse(parts._replace(query=new_query))


def _resolve_ipv4(host: str, port: int) -> Optional[str]:
    try:
        infos = socket.getaddrinfo(host, port, family=socket.AF_INET, type=socket.SOCK_STREAM)
    except socket.gaierror:
        return None
    if not infos:
        return None
    return infos[0][4][0]


def main() -> int:
    try:
        print(build_url())
    except RuntimeError as exc:
        print(f"::error::{exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

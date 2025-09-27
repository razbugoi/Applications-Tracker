#!/usr/bin/env python3
"""Compute an IPv4-friendly connection string for Supabase migrations."""

from __future__ import annotations

import os
import sys
import urllib.parse

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
        url = "postgresql://postgres:{password}@db.{project}.supabase.net:5432/postgres".format(
            password=urllib.parse.quote(password),
            project=project,
        )

    parts = urllib.parse.urlparse(url)
    host = parts.hostname or ""
    if host.endswith(".supabase.co"):
        host = host[: -len(".supabase.co")] + ".supabase.net"

    netloc = host
    if parts.port:
        netloc = f"{host}:{parts.port}"

    if parts.username:
        userinfo = urllib.parse.quote(parts.username)
        if parts.password:
            userinfo += ":" + urllib.parse.quote(parts.password)
        netloc = f"{userinfo}@{netloc}"

    return urllib.parse.urlunparse(
        (
            parts.scheme,
            netloc,
            parts.path,
            parts.params,
            parts.query,
            parts.fragment,
        )
    )


def main() -> int:
    try:
        print(build_url())
    except RuntimeError as exc:
        print(f"::error::{exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

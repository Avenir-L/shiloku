#!/usr/bin/env python3
"""从浏览器或下载目录同步网易云 Cookie，并校验是否仍有效。"""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
COOKIE_FILE = SCRIPT_DIR / "netease.cookies.txt"
CONFIG_FILE = SCRIPT_DIR / "netease-sync-config.json"

DEFAULT_CONFIG = {
    "browsers": ["edge", "chrome"],
    "watchDownloads": True,
}


def load_config() -> dict:
    config = dict(DEFAULT_CONFIG)
    if CONFIG_FILE.is_file():
        with CONFIG_FILE.open(encoding="utf-8") as handle:
            config.update(json.load(handle))
    return config


def netscape_to_header(raw: str) -> str:
    text = (raw or "").strip()
    if not text:
        return ""
    if text.startswith("# Netscape") or "\t" in text:
        parts = []
        for line in text.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            cols = line.split("\t")
            if len(cols) >= 7 and cols[5]:
                parts.append(f"{cols[5]}={cols[6]}")
        return "; ".join(parts)
    return text


def validate_cookie_content(raw: str) -> tuple[bool, str]:
    header = netscape_to_header(raw)
    if "MUSIC_U=" not in header:
        return False, "missing_music_u"
    request = urllib.request.Request(
        "https://music.163.com/api/nuser/account/get",
        headers={
            "Referer": "https://music.163.com/",
            "User-Agent": "Mozilla/5.0",
            "Cookie": header,
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            data = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return False, "account_check_failed"
    if data.get("code") == 200 and (data.get("account") or {}).get("id"):
        return True, str(data["account"]["id"])
    return False, "not_logged_in"


def export_from_browser(browser: str) -> str | None:
    ytdlp = os.environ.get("YT_DLP") or "yt-dlp"
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".txt") as temp_file:
            temp_path = temp_file.name
        completed = subprocess.run(
            [
                ytdlp,
                f"--cookies-from-browser={browser}",
                "--cookies",
                temp_path,
                "--skip-download",
                "https://music.163.com/",
            ],
            capture_output=True,
            text=True,
            timeout=90,
            check=False,
        )
        if completed.returncode != 0:
            return None
        content = Path(temp_path).read_text(encoding="utf-8", errors="ignore")
        ok, _ = validate_cookie_content(content)
        return content if ok else None
    except (OSError, subprocess.SubprocessError, ValueError):
        return None
    finally:
        if temp_path:
            Path(temp_path).unlink(missing_ok=True)


def find_downloads_export() -> str | None:
    downloads = Path.home() / "Downloads"
    if not downloads.is_dir():
        return None
    candidates = sorted(
        [
            *downloads.glob("*163*cookies*.txt"),
            *downloads.glob("music.163.com_cookies.txt"),
        ],
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    seen = set()
    for path in candidates:
        resolved = str(path.resolve())
        if resolved in seen:
            continue
        seen.add(resolved)
        try:
            content = path.read_text(encoding="utf-8")
        except OSError:
            continue
        ok, _ = validate_cookie_content(content)
        if ok:
            return content
    return None


def content_hash(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def emit(payload: dict) -> int:
    print(json.dumps(payload, ensure_ascii=False))
    return 0 if payload.get("ok") else 1


def main() -> int:
    config = load_config()
    chosen = None
    source = None

    for browser in config.get("browsers") or []:
        content = export_from_browser(str(browser))
        if content:
            chosen = content
            source = f"browser:{browser}"
            break

    if not chosen and config.get("watchDownloads", True):
        content = find_downloads_export()
        if content:
            chosen = content
            source = "downloads"

    if COOKIE_FILE.is_file():
        existing = COOKIE_FILE.read_text(encoding="utf-8")
        existing_ok, user_id = validate_cookie_content(existing)
        if existing_ok and not chosen:
            return emit({
                "ok": True,
                "updated": False,
                "source": "existing",
                "valid": True,
                "userId": user_id,
            })
        if existing_ok and chosen and content_hash(existing) == content_hash(chosen):
            return emit({
                "ok": True,
                "updated": False,
                "source": source,
                "valid": True,
                "unchanged": True,
                "userId": user_id,
            })

    if not chosen:
        if COOKIE_FILE.is_file():
            existing_ok, _ = validate_cookie_content(COOKIE_FILE.read_text(encoding="utf-8"))
            if existing_ok:
                return emit({
                    "ok": True,
                    "updated": False,
                    "source": "existing",
                    "valid": True,
                    "warning": "refresh_failed_keep_existing",
                })
        return emit({"ok": False, "updated": False, "error": "no_valid_cookie_source"})

    normalized = chosen if chosen.endswith("\n") else f"{chosen}\n"
    COOKIE_FILE.write_text(normalized, encoding="utf-8")
    ok, user_id = validate_cookie_content(normalized)
    if not ok:
        return emit({"ok": False, "updated": False, "error": "saved_cookie_invalid"})

    return emit({
        "ok": True,
        "updated": True,
        "source": source,
        "userId": user_id,
    })


if __name__ == "__main__":
    sys.exit(main())

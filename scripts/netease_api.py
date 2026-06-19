"""Netease Cloud Music proxy helpers (sonic-topography style)."""
import json
import os
import time
import urllib.parse
import urllib.request

NETEASE_HEADERS = {
    "Referer": "https://music.163.com/",
    "User-Agent": "Mozilla/5.0",
}

_playable_cache = {}
_search_cache = {}
_playable_ttl = 600
_search_ttl = 300
PAGE_RAW_SIZE = 30
_COOKIE_FILE = os.path.join(os.path.dirname(__file__), "netease.cookies.txt")


def _cookie_header():
    cookie = os.environ.get("NETEASE_COOKIE", "").strip()
    if not cookie and os.path.isfile(_COOKIE_FILE):
        try:
            with open(_COOKIE_FILE, encoding="utf-8") as f:
                cookie = f.read().strip()
        except OSError:
            cookie = ""
    if not cookie:
        return {}
    # Netscape cookie jar: extract name=value pairs if user pasted full export
    if cookie.startswith("# Netscape") or "\t" in cookie:
        parts = []
        for line in cookie.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            cols = line.split("\t")
            if len(cols) >= 7 and cols[5]:
                parts.append(f"{cols[5]}={cols[6]}")
        if parts:
            cookie = "; ".join(parts)
    return {"Cookie": cookie}


def _fetch_json(url, method="GET", data=None, extra_headers=None):
    headers = dict(NETEASE_HEADERS)
    headers.update(_cookie_header())
    if extra_headers:
        headers.update(extra_headers)
    body = None
    if data is not None:
        body = urllib.parse.urlencode(data).encode("utf-8")
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def get_playable_url(song_id):
    now = time.time()
    cached = _playable_cache.get(song_id)
    if cached and cached["expires_at"] > now:
        return cached["url"]

    url = (
        "https://music.163.com/api/song/enhance/player/url?id="
        f"{urllib.parse.quote(str(song_id))}&ids=%5B{urllib.parse.quote(str(song_id))}%5D&br=320000"
    )
    data = _fetch_json(url)
    playable = (data.get("data") or [{}])[0].get("url")
    _playable_cache[song_id] = {"url": playable, "expires_at": now + _playable_ttl}
    return playable


def filter_playable(raw_songs, result_limit):
    from concurrent.futures import ThreadPoolExecutor

    playable = []
    batch_size = 12
    i = 0
    while i < len(raw_songs) and len(playable) < result_limit:
        batch = raw_songs[i:i + batch_size]
        with ThreadPoolExecutor(max_workers=min(8, len(batch) or 1)) as pool:
            ordered = [(song, pool.submit(get_playable_url, str(song["id"]))) for song in batch]
            for song, future in ordered:
                try:
                    if future.result():
                        playable.append(song)
                        if len(playable) >= result_limit:
                            break
                except Exception:
                    continue
        i += batch_size
    return playable


def search_songs(keywords, result_limit=12, offset=0):
    offset = max(0, int(offset))
    fetch_limit = PAGE_RAW_SIZE
    cache_key = f"{keywords.lower()}::{offset}::{result_limit}::{fetch_limit}"
    now = time.time()
    cached = _search_cache.get(cache_key)
    if cached and cached["expires_at"] > now:
        return {**cached["payload"], "cached": True}

    data = _fetch_json(
        "https://music.163.com/api/search/get/web",
        method="POST",
        data={
            "s": keywords,
            "type": "1",
            "offset": str(offset),
            "total": "true",
            "limit": str(fetch_limit),
        },
    )
    result = data.get("result") or {}
    raw = []
    for song in result.get("songs") or []:
        album = song.get("album") or {}
        raw.append({
            "id": song.get("id"),
            "name": song.get("name") or "",
            "artist": " / ".join(a.get("name", "") for a in (song.get("artists") or []) if a.get("name")),
            "album": album.get("name") or "",
            "cover": album.get("picUrl") or album.get("blurPicUrl") or "",
            "duration": song.get("duration") or 0,
            "fee": song.get("fee"),
        })
    songs = filter_playable(raw, result_limit)
    total = int(result.get("songCount") or 0)
    fetched = len(raw)
    has_more = offset + fetched < total
    payload = {
        "songs": songs,
        "total": total,
        "offset": offset,
        "pageSize": PAGE_RAW_SIZE,
        "hasMore": has_more,
        "nextOffset": offset + fetched if has_more else offset,
    }
    _search_cache[cache_key] = {"payload": payload, "expires_at": now + _search_ttl}
    return payload


def fetch_lyric(song_id):
    data = _fetch_json(
        f"https://music.163.com/api/song/lyric?id={urllib.parse.quote(str(song_id))}&lv=-1&kv=-1&tv=-1"
    )
    return {
        "lyric": ((data.get("lrc") or {}).get("lyric")) or "",
        "translatedLyric": ((data.get("tlyric") or {}).get("lyric")) or "",
    }


def open_audio_stream(song_id, range_header=None):
    playable = get_playable_url(str(song_id))
    if not playable:
        return None, None
    headers = dict(NETEASE_HEADERS)
    headers.update(_cookie_header())
    if range_header:
        headers["Range"] = range_header
    req = urllib.request.Request(playable, headers=headers, method="GET")
    return urllib.request.urlopen(req, timeout=30), req

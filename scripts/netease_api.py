"""Netease Cloud Music proxy helpers (sonic-topography style)."""
import json
import os
import re
import time
import urllib.parse
import urllib.request

NETEASE_HEADERS = {
    "Referer": "https://music.163.com/",
    "User-Agent": "Mozilla/5.0",
}

_playable_cache = {}
_search_cache = {}
_playable_ttl = 1800
_search_ttl = 900
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


def get_playable_map(song_ids):
    result = {}
    for song_id in (song_ids or [])[:30]:
        key = str(song_id)
        try:
            result[key] = bool(get_playable_url(key))
        except Exception:
            result[key] = False
    return result


def search_songs(keywords, result_limit=30, offset=0):
    offset = max(0, int(offset))
    fetch_limit = PAGE_RAW_SIZE
    cookie = _cookie_header().get("Cookie", "")
    cookie_tag = "auth" if "MUSIC_U=" in cookie else "anon"
    cache_key = f"{cookie_tag}::{keywords.lower()}::{offset}::{result_limit}::{fetch_limit}"
    now = time.time()
    cached = _search_cache.get(cache_key)
    if cached and cached["expires_at"] > now:
        return {**cached["payload"], "cached": True}

    params = {
        "s": keywords,
        "type": "1",
        "offset": str(offset),
        "total": "true",
        "limit": str(fetch_limit),
    }
    result = None
    try:
        get_url = "https://music.163.com/api/search/get?" + urllib.parse.urlencode(params)
        data = _fetch_json(get_url)
        if data.get("code") == 200 and (data.get("result") or {}).get("songs"):
            result = data["result"]
    except Exception:
        result = None
    if not result:
        data = _fetch_json(
            "https://music.163.com/api/search/get/web",
            method="POST",
            data=params,
        )
        if data.get("code") == 200 and data.get("result"):
            result = data["result"]
    result = result or {}
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
    songs = raw
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
    if total > 0 or songs:
        _search_cache[cache_key] = {"payload": payload, "expires_at": now + _search_ttl}
    return payload


def _yrc_text_to_lrc(yrc_text):
    if not yrc_text:
        return ""
    lines_out = []
    line_re = re.compile(r"^\[(\d+),\d+\](.*)$")
    token_re = re.compile(r"\((\d+),(\d+),(\d+)\)")
    for raw in yrc_text.splitlines():
        raw = raw.strip()
        if not raw:
            continue
        match = line_re.match(raw)
        if not match:
            continue
        start_ms = int(match.group(1))
        body = match.group(2)
        if body.startswith("{"):
            continue
        parts = []
        pos = 0
        while pos < len(body):
            token = token_re.match(body, pos)
            if not token:
                parts.append(body[pos:])
                break
            pos = token.end()
            end = pos
            while end < len(body) and body[end] != "(":
                end += 1
            parts.append(body[pos:end])
            pos = end
        text = "".join(parts).strip()
        if not text:
            continue
        total_sec = start_ms / 1000.0
        minutes = int(total_sec // 60)
        seconds = total_sec - minutes * 60
        lines_out.append(f"[{minutes:02d}:{seconds:05.2f}]{text}")
    return "\n".join(lines_out)


def fetch_lyric(song_id):
    data = _fetch_json(
        f"https://music.163.com/api/song/lyric?id={urllib.parse.quote(str(song_id))}&lv=-1&kv=-1&tv=-1"
    )
    lyric = ((data.get("lrc") or {}).get("lyric")) or ""
    translated = ((data.get("tlyric") or {}).get("lyric")) or ""
    if not lyric:
        for key in ("yrc", "klyric"):
            block = data.get(key) or {}
            converted = _yrc_text_to_lrc(block.get("lyric") or "")
            if converted:
                lyric = converted
                break
    return {
        "lyric": lyric,
        "translatedLyric": translated,
        "hasTranslation": bool(translated.strip()),
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


def fetch_account():
    data = _fetch_json("https://music.163.com/api/nuser/account/get")
    account = data.get("account") or {}
    if data.get("code") != 200 or not account.get("id"):
        return None
    return account


def fetch_user_level():
    data = _fetch_json("https://music.163.com/api/user/level")
    if data.get("code") != 200:
        return None
    return data


def fetch_week_play_record(uid):
    data = _fetch_json(f"https://music.163.com/api/play/record?uid={urllib.parse.quote(str(uid))}&type=1")
    week_data = data.get("weekData") or []
    seconds = 0
    for item in week_data:
        song = item.get("song") or {}
        duration_ms = int(song.get("dt") or 0)
        play_count = min(int(item.get("playCount") or 1), 80)
        if duration_ms > 0:
            seconds += (duration_ms // 1000) * play_count
    return {"seconds": seconds, "trackCount": len(week_data)}


def listen_stats():
    if not _cookie_header().get("Cookie"):
        return {"available": False, "reason": "missing_cookie"}
    account = fetch_account()
    if not account:
        return {"available": False, "reason": "not_logged_in"}
    uid = account.get("id")
    level = fetch_user_level() or {}
    week = fetch_week_play_record(uid)
    return {
        "available": True,
        "userId": uid,
        "nickname": account.get("nickname") or "",
        "totalPlayCount": ((level.get("data") or {}).get("nowPlayCount")),
        "weekListenSeconds": week.get("seconds", 0),
        "weekTrackCount": week.get("trackCount", 0),
        "officialTodayAvailable": False,
        "officialMonthAvailable": False,
    }


_runtime_cookie = ""


def set_runtime_cookie(raw):
    global _runtime_cookie
    cookie = str(raw or "").strip()
    if not cookie:
        _runtime_cookie = ""
        return ""
    if cookie.startswith("# Netscape") or "\t" in cookie:
        parts = []
        for line in cookie.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            cols = line.split("\t")
            if len(cols) >= 7 and cols[5]:
                parts.append(f"{cols[5]}={cols[6]}")
        cookie = "; ".join(parts)
    _runtime_cookie = cookie
    try:
        with open(_COOKIE_FILE, "w", encoding="utf-8") as f:
            f.write(cookie)
    except OSError:
        pass
    return cookie


def _cookie_header_with(raw_cookie=None):
    cookie = str(raw_cookie or _runtime_cookie or os.environ.get("NETEASE_COOKIE", "")).strip()
    if not cookie and os.path.isfile(_COOKIE_FILE):
        try:
            with open(_COOKIE_FILE, encoding="utf-8") as f:
                cookie = f.read().strip()
        except OSError:
            cookie = ""
    if not cookie:
        return {}
    if cookie.startswith("# Netscape") or "\t" in cookie:
        parts = []
        for line in cookie.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            cols = line.split("\t")
            if len(cols) >= 7 and cols[5]:
                parts.append(f"{cols[5]}={cols[6]}")
        cookie = "; ".join(parts)
    return {"Cookie": cookie}


def _fetch_json_with_cookie(url, cookie="", method="GET", data=None):
    headers = dict(NETEASE_HEADERS)
    headers.update(_cookie_header_with(cookie))
    body = None
    if data is not None:
        body = urllib.parse.urlencode(data).encode("utf-8")
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def validate_cookie(cookie=""):
    header = _cookie_header_with(cookie)
    if not header.get("Cookie"):
        return {"hasCookie": False, "valid": False, "userId": None, "nickname": ""}
    account = fetch_account_with_cookie(cookie)
    if not account:
        return {"hasCookie": True, "valid": False, "userId": None, "nickname": ""}
    return {
        "hasCookie": True,
        "valid": True,
        "userId": account.get("id"),
        "nickname": account.get("nickname") or "",
    }


def fetch_account_with_cookie(cookie=""):
    data = _fetch_json_with_cookie("https://music.163.com/api/nuser/account/get", cookie)
    account = data.get("account") or {}
    if data.get("code") != 200 or not account.get("id"):
        return None
    return account


def _map_song(song):
    album = song.get("album") or {}
    artists = song.get("artists") or song.get("ar") or []
    return {
        "id": song.get("id"),
        "name": song.get("name") or "",
        "artist": " / ".join(a.get("name", "") for a in artists if a.get("name")),
        "album": album.get("name") or "",
        "cover": album.get("picUrl") or album.get("blurPicUrl") or song.get("picUrl") or "",
        "duration": song.get("duration") or song.get("dt") or 0,
        "fee": song.get("fee"),
    }


def fetch_user_playlists(cookie=""):
    account = fetch_account_with_cookie(cookie)
    if not account:
        return {"valid": False, "playlists": []}
    uid = account.get("id")
    data = _fetch_json_with_cookie(
        f"https://music.163.com/api/user/playlist?uid={urllib.parse.quote(str(uid))}&limit=100&offset=0",
        cookie,
    )
    playlists = []
    for item in data.get("playlist") or []:
        playlists.append({
            "id": item.get("id"),
            "name": item.get("name") or "",
            "trackCount": item.get("trackCount") or 0,
        })
    return {"valid": True, "playlists": playlists}


def fetch_playlist_songs(playlist_id, cookie="", result_limit=50):
    limit = max(1, min(int(result_limit or 50), 80))
    data = _fetch_json_with_cookie(
        f"https://music.163.com/api/v6/playlist/detail?id={urllib.parse.quote(str(playlist_id))}&n={limit * 2}",
        cookie,
    )
    tracks = ((data.get("playlist") or {}).get("tracks")) or []
    raw = [_map_song(track) for track in tracks]
    return filter_playable(raw, limit)


def fetch_liked_songs(cookie="", result_limit=50):
    payload = fetch_user_playlists(cookie)
    if not payload.get("valid") or not payload.get("playlists"):
        return {"valid": False, "songs": [], "playlist": None}
    liked = payload["playlists"][0]
    songs = fetch_playlist_songs(liked["id"], cookie, result_limit)
    return {"valid": True, "songs": songs, "playlist": liked}


def fetch_daily_recommend(cookie="", result_limit=50):
    if not fetch_account_with_cookie(cookie):
        return {"valid": False, "songs": []}
    data = _fetch_json_with_cookie("https://music.163.com/api/v3/discovery/recommend/songs", cookie)
    raw_items = ((data.get("data") or {}).get("dailySongs")) or data.get("recommend") or []
    raw = [_map_song(item) for item in raw_items]
    return {"valid": True, "songs": filter_playable(raw, max(1, min(int(result_limit or 50), 80)))}


def resolve_request_cookie(header_cookie=""):
    cookie = str(header_cookie or "").strip()
    if cookie:
        return cookie
    if _runtime_cookie:
        return _runtime_cookie
    header = _cookie_header_with()
    return header.get("Cookie", "")


def _run_node_qr(action, *args):
    import subprocess

    cli = os.path.join(os.path.dirname(__file__), "netease-qr-cli.mjs")
    cmd = ["node", cli, action, *args]
    completed = subprocess.run(cmd, capture_output=True, text=True, timeout=45, check=False)
    text = (completed.stdout or completed.stderr or "").strip()
    if not text:
        raise RuntimeError("扫码服务无响应，请确认已安装 Node.js")
    data = json.loads(text.splitlines()[-1])
    if data.get("error"):
        raise RuntimeError(data["error"])
    return data


def qr_login_create():
    return _run_node_qr("create")


def qr_login_check(key):
    result = _run_node_qr("check", str(key or ""))
    cookie = str(result.get("cookie") or "").strip()
    if cookie:
        set_runtime_cookie(cookie)
    payload = {
        "code": result.get("code"),
        "message": result.get("message") or "",
        "hasCookie": bool(cookie),
    }
    if result.get("code") == 803:
        payload["expired"] = True
    if result.get("code") == 801:
        payload["waiting"] = True
    if result.get("code") == 802:
        payload["scanned"] = True
    if result.get("code") == 800 and cookie:
        account = validate_cookie(cookie)
        payload.update({
            "cookie": cookie,
            "valid": account.get("valid"),
            "nickname": account.get("nickname") or "",
            "userId": account.get("userId"),
        })
    return payload


def refresh_cookie(cookie=""):
    resolved = resolve_request_cookie(cookie)
    if not resolved:
        return {"hasCookie": False, "valid": False, "cookie": ""}
    result = _run_node_qr("refresh", resolved)
    next_cookie = str(result.get("cookie") or resolved).strip()
    set_runtime_cookie(next_cookie)
    account = validate_cookie(next_cookie)
    return {
        **account,
        "cookie": next_cookie,
        "refreshCode": result.get("code"),
    }


def bootstrap_cookie():
    header = _cookie_header_with()
    cookie = header.get("Cookie", "")
    if not cookie:
        return {"hasCookie": False, "valid": False, "cookie": ""}
    account = validate_cookie(cookie)
    return {
        **account,
        "cookie": cookie if account.get("valid") else "",
    }

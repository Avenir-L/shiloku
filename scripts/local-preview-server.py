"""Local preview: static files + /api/chat + /api/netease proxy."""
import json
import os
import sys
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, SCRIPTS_DIR)

import netease_api
from preview_port import PORT, prepare_preview_port, register_shutdown, write_pid_file

SECRETS_FILE = os.path.join(SCRIPTS_DIR, "secrets.local.json")


def load_api_key():
    key = os.environ.get("DEEPSEEK_API_KEY", "").strip()
    if key:
        return key
    if os.path.isfile(SECRETS_FILE):
        with open(SECRETS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return (data.get("deepseekApiKey") or "").strip()
    return ""


class PreviewHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_OPTIONS(self):
        if self.path.startswith("/api/"):
            self.send_response(204)
            self._cors()
            self.end_headers()
            return
        super().do_OPTIONS()

    def _load_status_sync_secret(self):
        key = os.environ.get("STATUS_SYNC_SECRET", "").strip()
        if key:
            return key
        if os.path.isfile(SECRETS_FILE):
            try:
                with open(SECRETS_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                return (data.get("statusSyncSecret") or "").strip()
            except (OSError, json.JSONDecodeError):
                pass
        return ""

    def _handle_status_update_post(self, payload):
        secret = self._load_status_sync_secret()
        auth = self.headers.get("Authorization", "")
        token = auth[7:].strip() if auth.startswith("Bearer ") else ""
        if not secret or token != secret:
            self._json(401, {"error": "未授权"})
            return
        if not payload or not payload.get("text"):
            self._json(400, {"error": "状态格式无效"})
            return
        status_path = os.path.join(ROOT, "status.json")
        try:
            with open(status_path, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False)
            self._json(200, {"ok": True, "storage": "local-file"})
        except OSError as e:
            self._json(500, {"error": f"写入失败: {e}"})

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/status":
            self._handle_status()
            return
        if parsed.path == "/api/guestbook":
            self._handle_guestbook_get()
            return
        if parsed.path.startswith("/api/netease/"):
            self._handle_netease_get(parsed)
            return
        super().do_GET()

    def _guestbook_path(self):
        return os.path.join(SCRIPTS_DIR, ".guestbook-local.json")

    def _read_guestbook_static(self):
        path = os.path.join(ROOT, "guestbook.json")
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return data.get("messages") if isinstance(data, dict) else []
        except (OSError, json.JSONDecodeError):
            return []

    def _read_guestbook(self):
        messages = self._read_guestbook_static()
        local_path = self._guestbook_path()
        try:
            with open(local_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            local = data.get("messages") if isinstance(data, dict) else []
        except (OSError, json.JSONDecodeError):
            local = []
        ids = {m.get("id") for m in messages}
        for item in local:
            if item.get("id") not in ids:
                messages.append(item)
        messages.sort(key=lambda m: m.get("time") or 0, reverse=True)
        return messages[:80]

    def _write_guestbook(self, messages):
        path = self._guestbook_path()
        with open(path, "w", encoding="utf-8") as f:
            json.dump({"messages": messages[:80]}, f, ensure_ascii=False, indent=2)

    def _handle_guestbook_get(self):
        self._json(200, {"messages": self._read_guestbook()[:80]})

    def _handle_guestbook_post(self, payload):
        name = (payload.get("name") or "访客").strip()[:32] or "访客"
        message = (payload.get("message") or "").strip()[:280]
        if len(message) < 2:
            self._json(400, {"error": "留言太短了"})
            return
        entry = {
            "id": f"gb-{int(__import__('time').time() * 1000)}",
            "name": name,
            "message": message,
            "time": int(__import__('time').time() * 1000),
        }
        messages = self._read_guestbook()
        messages.insert(0, entry)
        try:
            self._write_guestbook(messages)
            self._json(200, {"ok": True, "message": entry})
        except OSError as e:
            self._json(500, {"error": f"保存失败: {e}"})

    def _handle_status(self):
        status_path = os.path.join(ROOT, "status.json")
        try:
            with open(status_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (OSError, json.JSONDecodeError):
            data = {"text": "在线摸鱼中", "updatedAt": None}
        self.send_response(200)
        self._cors()
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Content-Type", "application/json; charset=utf-8")
        raw = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self._safe_write(raw)

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length else b"{}"
        try:
            payload = json.loads(body.decode("utf-8"))
        except json.JSONDecodeError:
            self._json(400, {"error": "请求格式错误"})
            return

        if urlparse(self.path).path == "/api/status/update":
            self._handle_status_update_post(payload)
            return

        if self.path == "/api/guestbook":
            self._handle_guestbook_post(payload)
            return

        if self.path != "/api/chat":
            self.send_error(404)
            return

        api_key = load_api_key()
        if not api_key:
            self._json(500, {
                "error": "未配置 DeepSeek API Key。请在 scripts/secrets.local.json 填入 deepseekApiKey"
            })
            return

        user_message = (payload.get("message") or "").strip()
        if not user_message:
            self._json(400, {"error": "消息不能为空"})
            return

        now_playing = payload.get("nowPlaying") or {}
        lang = payload.get("lang") or "zh"
        music_context = ""
        if now_playing.get("title") or now_playing.get("artist"):
            title = now_playing.get("title") or "未知"
            artist = now_playing.get("artist") or "未知"
            music_context = f"\n访客当前在音乐室收听：「{title}」— {artist}。若问题与音乐相关，可结合这首歌作答。"
        lang_hint = ""
        if lang == "en":
            lang_hint = " Reply in English unless the visitor writes in another language."
        elif lang == "ja":
            lang_hint = " 访客界面为日语时，请用日语回答。"

        req_body = json.dumps({
            "model": "deepseek-chat",
            "messages": [
                {
                    "role": "system",
                    "content": f"你现在的身份是栀落余殁（Shiloku）的专属网页AI助理。请用高冷、简短的语气回答访客问题。{lang_hint}{music_context}"
                },
                {"role": "user", "content": user_message}
            ],
            "stream": False
        }).encode("utf-8")

        req = urllib.request.Request(
            "https://api.deepseek.com/chat/completions",
            data=req_body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}"
            },
            method="POST"
        )

        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", errors="replace")
            self._json(500, {"error": f"DeepSeek 请求失败: {detail[:200]}"})
            return
        except Exception as e:
            self._json(500, {"error": f"网络请求失败: {e}"})
            return

        choices = data.get("choices") or []
        if choices and choices[0].get("message", {}).get("content"):
            self._json(200, {"reply": choices[0]["message"]["content"]})
        else:
            self._json(500, {"error": "AI 返回的格式异常"})

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Range")

    def _handle_netease_get(self, parsed):
        query = parse_qs(parsed.query)
        action = parsed.path.replace("/api/netease/", "", 1)

        try:
            if action == "ping":
                self._json(200, {"ok": True})
                return

            if action == "search":
                keywords = (query.get("keywords") or [""])[0].strip()
                limit = int((query.get("limit") or ["12"])[0])
                offset = int((query.get("offset") or ["0"])[0])
                limit = max(1, min(limit, 20))
                offset = max(0, offset)
                if not keywords:
                    self._json(400, {"error": "请输入搜索关键词"})
                    return
                self._json(200, netease_api.search_songs(keywords, limit, offset))
                return

            if action == "url":
                song_id = (query.get("id") or [""])[0].strip()
                if not song_id:
                    self._json(400, {"error": "缺少歌曲 id"})
                    return
                self._json(200, {"url": netease_api.get_playable_url(song_id)})
                return

            if action == "lyric":
                song_id = (query.get("id") or [""])[0].strip()
                if not song_id:
                    self._json(400, {"error": "缺少歌曲 id"})
                    return
                self._json(200, netease_api.fetch_lyric(song_id))
                return

            if action == "audio":
                song_id = (query.get("id") or [""])[0].strip()
                if not song_id:
                    self._json(400, {"error": "缺少歌曲 id"})
                    return
                range_header = self.headers.get("Range")
                try:
                    stream, _req = netease_api.open_audio_stream(song_id, range_header)
                except urllib.error.HTTPError as e:
                    self.send_error(e.code)
                    return
                if not stream:
                    self._json(404, {"error": "这首歌暂时无法播放"})
                    return
                self.send_response(stream.status)
                self._cors()
                for header in ("Content-Type", "Content-Length", "Content-Range", "Accept-Ranges"):
                    value = stream.headers.get(header)
                    if value:
                        self.send_header(header, value)
                if not stream.headers.get("Content-Type"):
                    self.send_header("Content-Type", "audio/mpeg")
                self.end_headers()
                while True:
                    chunk = stream.read(64 * 1024)
                    if not chunk:
                        break
                    if not self._safe_write(chunk):
                        break
                stream.close()
                return

            self._json(404, {"error": "接口不存在"})
        except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError):
            return
        except Exception as e:
            try:
                self._json(500, {"error": f"网易云请求失败: {e}"})
            except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError):
                return

    def _safe_write(self, data):
        try:
            self.wfile.write(data)
            return True
        except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError):
            return False

    def _json(self, code, obj):
        raw = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self._safe_write(raw)

    def log_message(self, fmt, *args):
        if args and str(args[0]).startswith("POST /api/chat"):
            print(f"[chat] {args[0]} {args[1]}")
        elif args and "GET" in str(args[0]):
            pass  # quiet static logs
        else:
            super().log_message(fmt, *args)


if __name__ == "__main__":
    os.chdir(ROOT)
    killed = prepare_preview_port(PORT)
    if killed:
        print(f"[preview] 已结束占用 {PORT} 端口的旧进程: {', '.join(map(str, killed))}")

    key = load_api_key()
    print("=" * 40)
    print("  Shiloku 本地预览")
    print(f"  http://localhost:{PORT}/index.html")
    print("  状态: 读取本地 status.json")
    if key:
        print("  AI小助手: 已配置 API Key")
    else:
        print("  AI小助手: 需配置 scripts/secrets.local.json")
    print("  网易云: /api/netease/search 已启用")
    print("=" * 40)

    try:
        server = ThreadingHTTPServer(("0.0.0.0", PORT), PreviewHandler)
    except OSError:
        print(f"\n[preview] 端口 {PORT} 仍被占用。")
        print("请先运行 scripts/stop-local-preview.bat，再重新启动。")
        print("不要用 python -m http.server 8765，请只用 start-local-preview.bat。")
        sys.exit(1)

    write_pid_file()
    register_shutdown(server.shutdown)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止")
    finally:
        server.server_close()

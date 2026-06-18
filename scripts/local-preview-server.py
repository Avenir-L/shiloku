"""Local preview: static files + /api/chat proxy for AI assistant."""
import json
import os
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SECRETS_FILE = os.path.join(os.path.dirname(__file__), "secrets.local.json")
PORT = 8765


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
        if self.path == "/api/chat":
            self.send_response(204)
            self._cors()
            self.end_headers()
            return
        super().do_OPTIONS()

    def do_POST(self):
        if self.path != "/api/chat":
            self.send_error(404)
            return

        api_key = load_api_key()
        if not api_key:
            self._json(500, {
                "error": "未配置 DeepSeek API Key。请在 scripts/secrets.local.json 填入 deepseekApiKey"
            })
            return

        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length else b"{}"
        try:
            payload = json.loads(body.decode("utf-8"))
            user_message = (payload.get("message") or "").strip()
        except json.JSONDecodeError:
            self._json(400, {"error": "请求格式错误"})
            return

        if not user_message:
            self._json(400, {"error": "消息不能为空"})
            return

        req_body = json.dumps({
            "model": "deepseek-chat",
            "messages": [
                {
                    "role": "system",
                    "content": "你现在的身份是栀落余殁（Shiloku）的专属网页AI助理。请用高冷、简短的语气回答访客问题。"
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
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, code, obj):
        raw = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def log_message(self, fmt, *args):
        if args and str(args[0]).startswith("POST /api/chat"):
            print(f"[chat] {args[0]} {args[1]}")
        elif args and "GET" in str(args[0]):
            pass  # quiet static logs
        else:
            super().log_message(fmt, *args)


if __name__ == "__main__":
    os.chdir(ROOT)
    key = load_api_key()
    print("=" * 40)
    print("  Shiloku 本地预览")
    print(f"  http://localhost:{PORT}/index.html")
    print("  状态: 读取本地 status.json")
    if key:
        print("  AI小助手: 已配置 API Key")
    else:
        print("  AI小助手: 需配置 scripts/secrets.local.json")
    print("=" * 40)
    server = ThreadingHTTPServer(("0.0.0.0", PORT), PreviewHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止")

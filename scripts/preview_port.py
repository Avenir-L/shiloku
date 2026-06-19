"""Release and guard the local preview port on Windows."""
import atexit
import os
import subprocess
import sys
import time

SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
PORT = 8765
PID_FILE = os.path.join(SCRIPTS_DIR, ".preview-server.pid")


def _pids_on_port(port: int) -> list[int]:
    if sys.platform != "win32":
        return []

    script = (
        f"Get-NetTCPConnection -LocalPort {port} -State Listen -ErrorAction SilentlyContinue | "
        "Select-Object -ExpandProperty OwningProcess -Unique"
    )
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command", script],
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return []

    pids: list[int] = []
    for line in (result.stdout or "").splitlines():
        value = line.strip()
        if value.isdigit():
            pid = int(value)
            if pid > 0:
                pids.append(pid)
    return sorted(set(pids))


def release_port(port: int = PORT) -> list[int]:
    killed: list[int] = []
    for pid in _pids_on_port(port):
        if pid == os.getpid():
            continue
        subprocess.run(
            ["taskkill", "/F", "/PID", str(pid)],
            capture_output=True,
            timeout=10,
            check=False,
        )
        killed.append(pid)

    if killed:
        time.sleep(0.4)
    return killed


def write_pid_file() -> None:
    with open(PID_FILE, "w", encoding="utf-8") as handle:
        handle.write(str(os.getpid()))


def remove_pid_file() -> None:
    try:
        os.remove(PID_FILE)
    except OSError:
        pass


def prepare_preview_port(port: int = PORT) -> list[int]:
    killed = release_port(port)
    remove_pid_file()
    return killed


def register_shutdown(cleanup) -> None:
    atexit.register(cleanup)
    atexit.register(remove_pid_file)

#!/usr/bin/env python3
"""从本机 .procreate 文件提取 QuickLook 预览图，生成 gallery/manifest.json。"""

from __future__ import annotations

import json
import re
import sys
import zipfile
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GALLERY_DIR = ROOT / "gallery"
IMAGES_DIR = GALLERY_DIR / "images"
THUMB_ENTRY = "QuickLook/Thumbnail.png"
MIN_BYTES = 5 * 1024 * 1024  # 跳过过小的草稿文件


def find_procreate_dir() -> Path | None:
    candidates: list[Path] = []
    for drive in ("D:/", "C:/Users"):
        base = Path(drive)
        if not base.exists():
            continue
        try:
            for f in base.rglob("*.procreate"):
                candidates.append(f.parent)
                if len(candidates) >= 3:
                    break
        except OSError:
            continue
        if candidates:
            break
    if not candidates:
        return None
    # 取包含最多 .procreate 的目录
    by_parent: dict[Path, int] = {}
    for p in candidates:
        by_parent[p] = by_parent.get(p, 0) + 1
    return max(by_parent, key=lambda k: (by_parent[k], str(k)))


def slugify(name: str) -> str:
    slug = re.sub(r"[^\w\u4e00-\u9fff-]+", "-", name.strip(), flags=re.UNICODE)
    slug = re.sub(r"-+", "-", slug).strip("-").lower()
    return slug or "artwork"


def save_image(data: bytes, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
        from PIL import Image

        img = Image.open(BytesIO(data))
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGBA")
        max_w = 1600
        if img.width > max_w:
            ratio = max_w / img.width
            img = img.resize((max_w, int(img.height * ratio)), Image.Resampling.LANCZOS)
        if img.mode == "RGBA":
            bg = Image.new("RGB", img.size, (12, 6, 20))
            bg.paste(img, mask=img.split()[3])
            img = bg
        img.save(dest, "JPEG", quality= 88, optimize=True)
    except Exception:
        dest.write_bytes(data)


def export_from_dir(source: Path) -> int:
    files = sorted(source.glob("*.procreate"), key=lambda p: p.stat().st_mtime, reverse=True)
    items = []
    index = 0

    for src in files:
        if src.stat().st_size < MIN_BYTES:
            continue
        title = src.stem
        wip = "未命名" in title or "未完成" in title
        index += 1
        slug = slugify(title)[:48]
        filename = f"{index:02d}-{slug}.jpg"
        out = IMAGES_DIR / filename

        try:
            with zipfile.ZipFile(src) as zf:
                if THUMB_ENTRY not in zf.namelist():
                    print(f"skip (no thumbnail): {title}", file=sys.stderr)
                    index -= 1
                    continue
                data = zf.read(THUMB_ENTRY)
        except zipfile.BadZipFile:
            print(f"skip (bad zip): {title}", file=sys.stderr)
            index -= 1
            continue

        save_image(data, out)
        items.append(
            {
                "id": f"{index:02d}",
                "title": title,
                "file": f"images/{filename}",
                "wip": wip,
            }
        )
        try:
            print(f"ok: {title} -> {filename}")
        except UnicodeEncodeError:
            print(f"ok: {filename}")

    manifest = {
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "source": str(source),
        "items": items,
    }
    GALLERY_DIR.mkdir(parents=True, exist_ok=True)
    (GALLERY_DIR / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return len(items)


def main() -> int:
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else find_procreate_dir()
    if not source or not source.exists():
        print("未找到 procreate 作品文件夹", file=sys.stderr)
        return 1
    print(f"source: {source}")
    count = export_from_dir(source)
    print(f"exported {count} images -> {GALLERY_DIR}")
    return 0 if count else 1


if __name__ == "__main__":
    raise SystemExit(main())

"""Split bg.jpg into four PNG layers with inpainted background for 2.5D parallax."""
from __future__ import annotations

import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageFilter
from transformers import pipeline

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "bg.jpg"
OUT_DIR = ROOT / "bg-layers"
MANIFEST = OUT_DIR / "manifest.json"

LAYERS = [
    ("far", 0.11),
    ("back", 0.30),
    ("mid", 0.52),
    ("front", 0.95),
]


def load_rgb(path: Path) -> np.ndarray:
    return np.array(Image.open(path).convert("RGB"))


def estimate_depth(image: Image.Image) -> np.ndarray:
    print("Loading depth model...")
    est = pipeline(
        task="depth-estimation",
        model="depth-anything/Depth-Anything-V2-Small-hf",
    )
    depth = est(image)["depth"].convert("L")
    depth = np.array(depth, dtype=np.float32)
    return 255.0 - depth


def build_masks(rgb: np.ndarray, depth: np.ndarray) -> dict[str, np.ndarray]:
    h, w = rgb.shape[:2]
    luma = (
        0.299 * rgb[:, :, 0]
        + 0.587 * rgb[:, :, 1]
        + 0.114 * rgb[:, :, 2]
    ).astype(np.float32)
    y = np.linspace(0.0, 1.0, h, dtype=np.float32)[:, None]

    depth_n = (depth - depth.min()) / max(depth.max() - depth.min(), 1.0)

    front = (luma < 84) & (y > 0.25) & (y < 0.98)
    front |= (depth_n > 0.82) & (luma < 95) & (y > 0.22)

    far = (y < 0.43) & ~front
    far |= (y < 0.50) & (luma > 108) & ~front

    back = (y > 0.34) & (y < 0.72) & (depth_n < 0.52) & ~front & ~far
    back |= (y > 0.36) & (y < 0.68) & (luma > 52) & (luma < 125) & ~front

    mid = (y > 0.44) & (y < 0.84) & ~front & ~far & ~back
    mid |= (depth_n > 0.38) & (depth_n < 0.78) & (y > 0.40) & ~front

    assigned = np.zeros((h, w), dtype=np.uint8)
    for idx, name in enumerate(["far", "back", "mid", "front"], start=1):
        mask = {"far": far, "back": back, "mid": mid, "front": front}[name]
        mask = mask & (assigned == 0)
        assigned[mask] = idx

    assigned[assigned == 0] = 1

    return {
        name: assigned == idx
        for idx, name in enumerate(["far", "back", "mid", "front"], start=1)
    }


def soften_alpha(mask: np.ndarray, blur: float = 1.2) -> np.ndarray:
    alpha = mask.astype(np.uint8) * 255
    img = Image.fromarray(alpha, mode="L")
    if blur > 0:
        img = img.filter(ImageFilter.GaussianBlur(blur))
    return np.array(img, dtype=np.uint8)


def inpaint_background(rgb: np.ndarray, front_mask: np.ndarray) -> np.ndarray:
    inpaint_mask = front_mask.astype(np.uint8) * 255
    inpaint_mask = cv2.dilate(inpaint_mask, np.ones((7, 7), np.uint8), iterations=2)
    bgr = rgb[:, :, ::-1].copy()
    filled = cv2.inpaint(bgr, inpaint_mask, 5, cv2.INPAINT_NS)
    return filled[:, :, ::-1].copy()


def export_layer(source: np.ndarray, mask: np.ndarray, path: Path, feather: float) -> None:
    alpha = soften_alpha(mask, blur=feather)
    rgba = np.dstack([source, alpha])
    Image.fromarray(rgba, mode="RGBA").save(path, optimize=True)


def compose_preview(layers: dict[str, Path], size: tuple[int, int]) -> Image.Image:
    w, h = size
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 255))
    for name in ["far", "back", "mid", "front"]:
        canvas = Image.alpha_composite(canvas, Image.open(layers[name]).convert("RGBA"))
    return canvas


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"Missing {SRC}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    rgb = load_rgb(SRC)
    image = Image.fromarray(rgb)

    print("Estimating depth...")
    depth = estimate_depth(image)
    masks = build_masks(rgb, depth)

    print("Inpainting behind foreground...")
    plate = inpaint_background(rgb, masks["front"])

    paths: dict[str, Path] = {}
    for name, _factor in LAYERS:
        src = plate if name != "front" else rgb
        path = OUT_DIR / f"{name}.png"
        export_layer(src, masks[name], path, feather=0.8 if name == "front" else 1.1)
        paths[name] = path
        print(f"  wrote {path.name}")

    compose_preview(paths, (rgb.shape[1], rgb.shape[0])).save(OUT_DIR / "preview.png", optimize=True)

    manifest = {
        "focusX": 0.58,
        "overscan": 1.08,
        "maxShift": 28,
        "layers": [{"id": name, "file": f"{name}.png", "depth": factor} for name, factor in LAYERS],
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Done. Preview: {OUT_DIR / 'preview.png'}")


if __name__ == "__main__":
    main()

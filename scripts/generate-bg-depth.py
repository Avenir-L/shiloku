"""为 bg.jpg 生成深度图与人物遮罩（一次性脚本）。"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from transformers import pipeline

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "bg.jpg"
OUT_DEPTH = ROOT / "bg-depth.jpg"
OUT_MASK = ROOT / "bg-depth-mask.png"


def build_foreground_mask(rgb: np.ndarray, depth: np.ndarray) -> np.ndarray:
    h, w = rgb.shape[:2]
    luma = (
        0.299 * rgb[:, :, 0]
        + 0.587 * rgb[:, :, 1]
        + 0.114 * rgb[:, :, 2]
    ).astype(np.float32)

    y = np.linspace(0.0, 1.0, h, dtype=np.float32)[:, None]

    # 深色剪影：女孩、猫、前景植物
    char = (luma < 78) & (y > 0.28) & (y < 0.96)

    # 天空与亮部：强制作为背景参与视差
    sky = (y < 0.4) | ((luma > 105) & (y < 0.58))

    # 城市灯光带：只排除中等亮度，保留深色人物
    city = (y > 0.4) & (y < 0.76) & (luma > 58) & (luma < 145)

    mask = char & ~sky & ~city

    # 补充：极暗且够近的像素
    near_dark = (depth > 200) & (luma < 72) & (y > 0.26) & ~sky
    mask = mask | near_dark

    mask = mask.astype(np.uint8) * 255
    mask_img = Image.fromarray(mask, mode="L")
    mask_img = mask_img.filter(ImageFilter.MaxFilter(5))
    mask_img = mask_img.filter(ImageFilter.MinFilter(3))
    mask_img = mask_img.filter(ImageFilter.GaussianBlur(1.5))
    return np.array(mask_img, dtype=np.uint8)


def refine_depth(depth: np.ndarray, mask: np.ndarray) -> np.ndarray:
    out = depth.astype(np.float32)
    fg = mask > 128
    out[fg] = 255.0
    blurred = np.array(
        Image.fromarray(out.astype(np.uint8)).filter(ImageFilter.GaussianBlur(2)),
        dtype=np.float32,
    )
    edge = (mask > 20) & (mask < 220)
    out[edge] = blurred[edge]
    return np.clip(out, 0, 255).astype(np.uint8)


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"找不到 {SRC}")

    print("加载深度模型…")
    est = pipeline(
        task="depth-estimation",
        model="depth-anything/Depth-Anything-V2-Small-hf",
    )

    print(f"处理 {SRC.name}…")
    image = Image.open(SRC).convert("RGB")
    rgb = np.array(image)
    result = est(image)
    depth = np.array(result["depth"].convert("L"))
    depth = 255 - depth

    mask = build_foreground_mask(rgb, depth)
    depth = refine_depth(depth, mask)

    Image.fromarray(depth).save(OUT_DEPTH, quality=92, optimize=True)
    Image.fromarray(mask).save(OUT_MASK, optimize=True)
    print(f"已保存 {OUT_DEPTH.name}、{OUT_MASK.name} ({depth.shape[1]}x{depth.shape[0]})")


if __name__ == "__main__":
    main()

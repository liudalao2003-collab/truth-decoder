"""将 docs/screenshots 下 PNG 用 Pillow 重新保存，最大化与 GitHub 预览兼容性。"""
from __future__ import annotations

import os
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SHOT = ROOT / "docs" / "screenshots"


def main() -> None:
    for path in sorted(SHOT.glob("*.png")):
        with Image.open(path) as im:
            im.load()
            mode = im.mode
            if mode == "P":
                im = im.convert("RGBA")
            elif mode in ("RGBA", "RGB"):
                pass
            else:
                im = im.convert("RGBA")
            # 保存为无隔行、标准 PNG；optimize 会重写 IDAT
            im.save(path, format="PNG", optimize=True, compress_level=9)
        print(f"OK {path.name}")


if __name__ == "__main__":
    main()

"""README hero banner: desktop + phone screenshots on the almanac paper background.

    python notebooks/hero.py   ->  docs/figures/hero.png
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "docs" / "screenshots"
OUT = ROOT / "docs" / "figures" / "hero.png"
PAPER, INK, EMBER = (250, 247, 242), (31, 27, 22), (200, 75, 26)


def rounded(im: Image.Image, r: int) -> Image.Image:
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, *im.size), r, fill=255)
    out = Image.new("RGBA", im.size)
    out.paste(im, (0, 0), mask)
    return out


def shadow(size: tuple[int, int], r: int, blur: int = 18) -> Image.Image:
    s = Image.new("RGBA", (size[0] + blur * 4, size[1] + blur * 4), (0, 0, 0, 0))
    ImageDraw.Draw(s).rounded_rectangle((blur * 2, blur * 2, blur * 2 + size[0], blur * 2 + size[1]), r,
                                        fill=(60, 40, 20, 90))
    return s.filter(ImageFilter.GaussianBlur(blur))


def font(size: int, bold: bool = False):
    for name in (("seguisb.ttf" if bold else "segoeui.ttf"), "arial.ttf", "DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def main() -> None:
    W, H = 1800, 900
    canvas = Image.new("RGBA", (W, H), PAPER + (255,))
    d = ImageDraw.Draw(canvas)
    # subtle almanac grid
    for x in range(0, W, 30):
        d.line([(x, 0), (x, H)], fill=(240, 234, 224), width=1)
    for y in range(0, H, 30):
        d.line([(0, y), (W, y)], fill=(240, 234, 224), width=1)

    desk = Image.open(SHOTS / "home_desktop.png").convert("RGB").crop((0, 0, 1280, 880))
    desk = desk.resize((1180, int(880 * 1180 / 1280)))
    desk = rounded(desk, 18)
    phone = Image.open(SHOTS / "home_mobile_bn.png").convert("RGB")
    phone = phone.crop((0, 0, phone.width, int(phone.width * 2.05)))
    phone = phone.resize((330, int(330 * phone.height / phone.width)))
    phone = rounded(phone, 34)

    dx, dy = 70, 60
    canvas.alpha_composite(shadow(desk.size, 18), (dx - 36, dy - 30))
    canvas.alpha_composite(desk, (dx, dy))
    px, py = W - phone.width - 90, H - phone.height - 40
    canvas.alpha_composite(shadow(phone.size, 34), (px - 36, py - 30))
    # phone bezel
    bezel = Image.new("RGBA", (phone.width + 20, phone.height + 20), (0, 0, 0, 0))
    ImageDraw.Draw(bezel).rounded_rectangle((0, 0, *bezel.size), 42, fill=INK + (255,))
    canvas.alpha_composite(bezel, (px - 10, py - 10))
    canvas.alpha_composite(phone, (px, py))

    # tag line ribbon
    d = ImageDraw.Draw(canvas)
    tag = "A fire record that doesn't break when the satellites do."
    f = font(30, bold=True)
    tw = d.textlength(tag, font=f)
    d.rounded_rectangle((dx, H - 92, dx + tw + 48, H - 36), 28, fill=EMBER)
    d.text((dx + 24, H - 86), tag, font=f, fill=(255, 255, 255))
    canvas.convert("RGB").save(OUT, optimize=True)
    print("wrote", OUT)


if __name__ == "__main__":
    main()

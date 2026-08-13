from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path(r"C:\Users\zn217\Desktop\商品展示\app-icon-previews")
OUT.mkdir(parents=True, exist_ok=True)
FONTS = Path(r"C:\Windows\Fonts")
SIZE = 1024


def font(path: str, size: int, index: int = 0) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / path), size=size, index=index)


def fill(color: str) -> Image.Image:
    return Image.new("RGB", (SIZE, SIZE), color)


def radial(base: Image.Image, inner: tuple[int, int, int], outer: tuple[int, int, int]) -> Image.Image:
    overlay = Image.new("RGB", (SIZE, SIZE), outer)
    mask = Image.new("L", (SIZE, SIZE), 0)
    d = ImageDraw.Draw(mask)
    for i in range(SIZE // 2, 0, -2):
        t = i / (SIZE / 2)
        v = int(255 * (t**1.6))
        d.ellipse((SIZE // 2 - i, SIZE // 2 - i, SIZE // 2 + i, SIZE // 2 + i), fill=v)
    return Image.composite(Image.new("RGB", (SIZE, SIZE), inner), overlay, mask)


def draw_char(img: Image.Image, text: str, fnt: ImageFont.FreeTypeFont, fill: str, dy: int = 0) -> None:
    d = ImageDraw.Draw(img)
    x0, y0, x1, y1 = d.textbbox((0, 0), text, font=fnt, anchor="lt")
    w, h = x1 - x0, y1 - y0
    x = (SIZE - w) / 2 - x0
    y = (SIZE - h) / 2 - y0 + dy
    d.text((x, y), text, font=fnt, fill=fill)


def rounded_square(draw: ImageDraw.ImageDraw, pad: int, radius: int, outline: str, width: int) -> None:
    draw.rounded_rectangle(
        (pad, pad, SIZE - pad, SIZE - pad),
        radius=radius,
        outline=outline,
        width=width,
    )


def icon1() -> Image.Image:
    """朱底金印"""
    img = radial(fill("#7a1f16"), (180, 58, 46), (92, 24, 18))
    d = ImageDraw.Draw(img)
    rounded_square(d, 86, 96, "#e4c36a", 18)
    rounded_square(d, 118, 80, "#c4a35a", 6)
    fnt = font("Source Han Serif SC Heavy (TrueType).ttf", 560)
    draw_char(img, "善", fnt, "#f0d48a", dy=-8)
    return img


def icon2() -> Image.Image:
    """墨底金字"""
    img = radial(fill("#2a2118"), (72, 48, 36), (28, 20, 14))
    d = ImageDraw.Draw(img)
    rounded_square(d, 92, 88, "#c4a35a", 14)
    fnt = font("NotoSerifSC-VF.ttf", 540)
    draw_char(img, "善", fnt, "#e2c174", dy=-6)
    return img


def icon3() -> Image.Image:
    """金底朱字"""
    img = radial(fill("#c4a35a"), (232, 196, 120), (141, 107, 47))
    d = ImageDraw.Draw(img)
    rounded_square(d, 90, 90, "#9d2a1f", 16)
    fnt = font("Source Han Serif SC Heavy (TrueType).ttf", 560)
    draw_char(img, "善", fnt, "#8a2218", dy=-8)
    return img


def paper_noise(img: Image.Image) -> Image.Image:
    import random

    px = img.load()
    rnd = random.Random(7)
    for _ in range(18000):
        x, y = rnd.randint(0, SIZE - 1), rnd.randint(0, SIZE - 1)
        r, g, b = px[x, y]
        n = rnd.randint(-10, 10)
        px[x, y] = (max(0, min(255, r + n)), max(0, min(255, g + n)), max(0, min(255, b + n)))
    return img.filter(ImageFilter.SMOOTH)


def icon4() -> Image.Image:
    """纸纹朱印"""
    img = radial(fill("#f4ead8"), (250, 241, 224), (226, 208, 176))
    img = paper_noise(img)
    d = ImageDraw.Draw(img)
    pad = 128
    d.rounded_rectangle((pad, pad, SIZE - pad, SIZE - pad), radius=48, fill="#c23a2b")
    d.rounded_rectangle((pad + 22, pad + 22, SIZE - pad - 22, SIZE - pad - 22), radius=36, outline="#f7e6c8", width=10)
    fnt = font("STKAITI.TTF", 500)
    draw_char(img, "善", fnt, "#fff6e4", dy=10)
    return img


def round_mask(src: Image.Image, radius: int) -> Image.Image:
    mask = Image.new("L", src.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, src.size[0] - 1, src.size[1] - 1), radius=radius, fill=255)
    out = Image.new("RGBA", src.size, (0, 0, 0, 0))
    out.paste(src.convert("RGBA"), mask=mask)
    return out


def contact_sheet(icons: list[tuple[str, Image.Image]]) -> Image.Image:
    gap, label_h, cell = 48, 72, 420
    cols, rows = 2, 2
    w = gap * 3 + cell * cols
    h = gap * 3 + (cell + label_h) * rows + 40
    sheet = Image.new("RGB", (w, h), "#1c1410")
    d = ImageDraw.Draw(sheet)
    title = font("msyhbd.ttc", 28)
    d.text((gap, 18), "善愿 App 图标预览  ·  请回复 1 / 2 / 3 / 4", font=title, fill="#f0d48a")
    caption = font("msyh.ttc", 26)
    for i, (name, icon) in enumerate(icons):
        r, c = divmod(i, 2)
        x = gap + c * (cell + gap)
        y = 56 + gap + r * (cell + label_h + gap)
        thumb = round_mask(icon.resize((cell, cell), Image.Resampling.LANCZOS), 92)
        sheet.paste(thumb, (x, y), thumb)
        d.text((x + cell / 2, y + cell + 18), name, font=caption, fill="#efe4d0", anchor="mt")
    return sheet


def main() -> None:
    icons = [
        ("1  朱底金印", icon1()),
        ("2  墨底金字", icon2()),
        ("3  金底朱字", icon3()),
        ("4  纸纹朱印", icon4()),
    ]
    names = ["1-zhu-jin.png", "2-mo-jin.png", "3-jin-zhu.png", "4-zhi-yin.png"]
    for (label, img), fn in zip(icons, names):
        img.save(OUT / fn, "PNG")
        print("wrote", fn, label)
    sheet = contact_sheet(icons)
    sheet.save(OUT / "preview-sheet.png", "PNG")
    print("wrote preview-sheet.png")


if __name__ == "__main__":
    main()

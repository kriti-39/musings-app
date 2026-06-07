# Generates branded PWA icons (navy bg + gold music note) at 192 and 512 px.
from PIL import Image, ImageDraw
import os

NAVY = (13, 17, 23)
NAVY2 = (22, 27, 34)
GOLD = (245, 197, 24)

def make_icon(size):
    sc = 4
    S = size * sc
    img = Image.new("RGB", (S, S), NAVY)
    d = ImageDraw.Draw(img)
    # subtle radial-ish vignette using a lighter rounded rect center
    d.rounded_rectangle([S*0.06, S*0.06, S*0.94, S*0.94], radius=S*0.18, fill=NAVY2)

    # Eighth note, centered in the maskable safe zone
    head_w, head_h = S*0.30, S*0.225
    hx, hy = S*0.40, S*0.66          # note-head centre
    d.ellipse([hx-head_w/2, hy-head_h/2, hx+head_w/2, hy+head_h/2], fill=GOLD)

    stem_w = S*0.05
    stem_x = hx + head_w/2 - stem_w
    stem_top = S*0.30
    d.rectangle([stem_x, stem_top, stem_x+stem_w, hy], fill=GOLD)

    # flag
    d.polygon([
        (stem_x+stem_w, stem_top),
        (stem_x+stem_w+S*0.20, stem_top+S*0.11),
        (stem_x+stem_w+S*0.17, stem_top+S*0.26),
        (stem_x+stem_w, stem_top+S*0.15),
    ], fill=GOLD)

    return img.resize((size, size), Image.LANCZOS)

os.makedirs(r"F:\JuniorProjects\Deva's Music Classes\public\icons", exist_ok=True)
for s in (192, 512):
    p = rf"F:\JuniorProjects\Deva's Music Classes\public\icons\icon-{s}.png"
    make_icon(s).save(p)
    print("wrote", p)

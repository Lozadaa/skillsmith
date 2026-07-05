#!/usr/bin/env python3
# Regenerate the blacksmith ASCII banner in src/art.ts.
#
#   python cli/scripts/gen-ascii.py [--width N] [--frame I]
#
# Pulls one frame from public/blacksmith-frames.png (a landscape 12-frame sprite,
# cleaner and shorter than the tall single illustration), INVERTS it (night-forge
# chalk: the linework becomes the lit part), crops to the drawing, and maps
# brightness -> a light..dense ramp. Prints a ready-to-paste TS string array.
#
# Requires Pillow:  pip install pillow
import sys
from PIL import Image, ImageOps, ImageEnhance

def arg(flag, default):
    return int(sys.argv[sys.argv.index(flag) + 1]) if flag in sys.argv else default

W = arg("--width", 44)
FRAME = arg("--frame", 5)
SRC = "public/blacksmith-frames.png"

sheet = Image.open(SRC).convert("L")
fw = sheet.width // 12
frame = sheet.crop((FRAME * fw, 0, (FRAME + 1) * fw, sheet.height))

im = ImageOps.invert(frame)                       # ink -> chalk
im = im.crop(im.point(lambda v: 255 if v > 40 else 0).getbbox())  # crop to drawing
im = ImageOps.autocontrast(im, cutoff=1)
im = ImageEnhance.Contrast(im).enhance(1.35)
H = int(W * (im.height / im.width) * 0.5)          # 0.5 ~= terminal cell aspect
small = im.resize((W, H), Image.LANCZOS)

ramp = " .:-=+*#%@"                                # bright(chalk) -> dense
n = len(ramp)
px = list(small.getdata())
rows = ["".join(ramp[min(n - 1, int(px[y * W + x] / 256 * n))] for x in range(W)).rstrip() for y in range(H)]
while rows and not rows[0].strip():
    rows.pop(0)
while rows and not rows[-1].strip():
    rows.pop()

print("export const BLACKSMITH_LINES: string[] = [")
for r in rows:
    print("  " + '"' + r.replace("\\", "\\\\").replace('"', '\\"') + '",')
print("];")

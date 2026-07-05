#!/usr/bin/env python3
# Regenerate the blacksmith ASCII banner in src/art.ts.
#
#   python cli/scripts/gen-ascii.py [SRC] [--width N]
#
# Defaults to public/blacksmith.png at width 28. The image is black ink on white
# paper, so we INVERT it first (night-forge chalk: the linework becomes the lit
# part) and then map brightness -> a light..dense ramp. Prints a ready-to-paste
# TypeScript string-array for BLACKSMITH_LINES.
#
# Requires Pillow:  pip install pillow
import sys
from PIL import Image, ImageOps, ImageEnhance

args = [a for a in sys.argv[1:] if not a.startswith("--")]
SRC = args[0] if args else "public/blacksmith.png"
W = 28
if "--width" in sys.argv:
    W = int(sys.argv[sys.argv.index("--width") + 1])

img = Image.open(SRC).convert("L")
img = ImageOps.invert(img)                      # ink -> chalk
img = ImageOps.autocontrast(img, cutoff=2)
img = ImageEnhance.Contrast(img).enhance(1.3)
H = int(W * (img.height / img.width) * 0.52)    # 0.52 ~= terminal cell aspect
small = img.resize((W, H), Image.LANCZOS)

ramp = " .:-=+*#%@"                             # bright(chalk) -> dense
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
